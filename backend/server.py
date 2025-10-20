#!/usr/bin/env python3
"""
Chameleon Backend - Python Flask Server
Handles OSINT tool execution (Sherlock, etc.)
"""

import os
import sys
import tempfile
import subprocess
import csv
from pathlib import Path
from datetime import datetime
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import threading
import queue
import time
import platform
import tarfile
import shutil
import requests

app = Flask(__name__)
CORS(app)

# Store active jobs
jobs = {}  # jobId -> { "buffer": queue.Queue() }


@app.route("/", methods=["GET"])
def health_check():
    return "ok", 200


@app.route("/scan", methods=["POST"])
def start_scan():
    """Start a Sherlock scan"""
    data = request.get_json()
    print(f"[POST /scan] received body: {data}")
    
    query = data.get("query")
    if not query or not isinstance(query, str):
        print("[POST /scan] invalid body -> 400")
        return jsonify({"error": "missing query"}), 400
    
    # Generate unique job ID
    job_id = datetime.now().strftime("%s%f")
    
    # Create job with buffer queue
    job_buffer = queue.Queue()
    jobs[job_id] = {"buffer": job_buffer}
    
    # Start scan in background thread
    thread = threading.Thread(target=run_sherlock_scan, args=(job_id, query, job_buffer))
    thread.daemon = True
    thread.start()
    
    print(f"[POST /scan] respond -> {{ jobId: \"{job_id}\" }}")
    return jsonify({"jobId": job_id})


@app.route("/stream/<job_id>", methods=["GET"])
def stream_results(job_id):
    """Stream scan results via Server-Sent Events"""
    job = jobs.get(job_id)
    if not job:
        print(f"[SSE connect] job {job_id} NOT FOUND -> 404")
        return "Job not found", 404
    
    print(f"[SSE connect] job {job_id} opened from {request.remote_addr}")
    
    def event_stream():
        job_buffer = job["buffer"]
        while True:
            try:
                # Get message from queue (blocks until available)
                message = job_buffer.get(timeout=1.0)
                if message is None:  # Sentinel value for done
                    break
                yield f"data: {message}\n\n"
            except queue.Empty:
                # Send keepalive
                yield ": keepalive\n\n"
    
    return Response(event_stream(), mimetype="text/event-stream")


def run_sherlock_scan(job_id, query, job_buffer):
    """Run Sherlock scan in background thread"""
    
    def push(msg_type, payload):
        """Push message to SSE stream"""
        import json
        msg = json.dumps({"type": msg_type, **payload})
        job_buffer.put(msg)
        print(f"[SSE][job {job_id}] -> {msg}")
    
    # Create temporary directory for Sherlock output
    work_dir = tempfile.mkdtemp(prefix="chameleon-")
    
    try:
        # Find Sherlock executable
        sherlock_bin = os.environ.get("SHERLOCK_BIN", find_sherlock())
        
        if not sherlock_bin:
            push("log", {"text": "ERROR: Sherlock not found. Please install: pip install sherlock-project"})
            push("done", {})
            return
        
        # Build command
        args = [sherlock_bin, query, "--csv", "--print-found"]
        
        print(f"[spawn] {' '.join(args)}  (cwd={work_dir})")
        
        # Run Sherlock
        process = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=work_dir,
            text=True,
            bufsize=1
        )
        
        # Stream stdout
        def read_stream(stream, label):
            for line in iter(stream.readline, ''):
                if line:
                    push("log", {"text": line})
        
        # Create threads to read stdout/stderr
        stdout_thread = threading.Thread(target=read_stream, args=(process.stdout, "stdout"))
        stderr_thread = threading.Thread(target=read_stream, args=(process.stderr, "stderr"))
        stdout_thread.daemon = True
        stderr_thread.daemon = True
        stdout_thread.start()
        stderr_thread.start()
        
        # Wait for completion
        return_code = process.wait()
        
        # Give threads a moment to finish reading
        stdout_thread.join(timeout=2)
        stderr_thread.join(timeout=2)
        
        print(f"[spawn close][job {job_id}] code={return_code}")
        
        # Small delay to ensure file is written
        import time
        time.sleep(0.5)
        
        # Parse CSV results BEFORE cleanup
        csv_path = find_csv_for_user(work_dir, query)
        print(f"[parse][job {job_id}] csvPath={csv_path or '(none)'}")
        
        if not csv_path:
            push("log", {"text": "No CSV file produced by Sherlock."})
        else:
            print(f"[parse][job {job_id}] Found CSV, parsing...")
            parse_and_send_results(csv_path, query, push)
            print(f"[parse][job {job_id}] CSV parsing complete")
        
    except Exception as e:
        print(f"[ERROR][job {job_id}] {str(e)}")
        push("log", {"text": f"Error: {str(e)}"})
    
    finally:
        # Cleanup temp directory
        try:
            import shutil
            shutil.rmtree(work_dir)
        except Exception as e:
            print(f"[cleanup][job {job_id}] {str(e)}")
        
        # Signal completion
        push("done", {})
        job_buffer.put(None)  # Sentinel


def find_sherlock():
    """Find Sherlock executable"""
    # Try common locations
    locations = [
        "/Library/Frameworks/Python.framework/Versions/3.13/bin/sherlock",
        "/usr/local/bin/sherlock",
        "sherlock"  # Try PATH
    ]
    
    for loc in locations:
        if os.path.exists(loc):
            return loc
    
    # Try 'which sherlock'
    try:
        result = subprocess.run(["which", "sherlock"], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except:
        pass
    
    return None


def find_csv_for_user(directory, query):
    """Find CSV file in directory"""
    # Sanitize query for filename
    safe_query = "".join(c if c.isalnum() else "_" for c in query)
    exact_path = os.path.join(directory, f"{safe_query}.csv")
    
    if os.path.exists(exact_path):
        return exact_path
    
    # Find any CSV file
    csv_files = list(Path(directory).glob("*.csv"))
    if csv_files:
        # Return most recent
        csv_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        return str(csv_files[0])
    
    return None


def parse_and_send_results(csv_path, query, push):
    """Parse Sherlock CSV and send results"""
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Try different column name variations
                site = (row.get("site") or row.get("name") or row.get("platform") or 
                       row.get("SITE") or row.get("Site") or "unknown")
                
                url_user = (row.get("url_user") or row.get("url user") or 
                           row.get("URL") or row.get("url") or "")
                
                status = str(row.get("status") or row.get("exists") or 
                           row.get("result") or "").upper()
                
                # Determine if found
                found = (
                    "FOUND" in status or 
                    "CLAIMED" in status or 
                    status == "TRUE" or
                    bool(url_user)
                )
                
                if found:
                    item = {
                        "id": f"{site}:{url_user or query}",
                        "site": site,
                        "title": f"{site} match for \"{query}\"",
                        "url": url_user,
                        "snippet": query,
                        "severity": infer_severity(site.lower()),
                        "confidence": 0.9
                    }
                    push("result", {"item": item})
    
    except Exception as e:
        push("log", {"text": f"Error parsing CSV: {str(e)}"})


def infer_severity(site):
    """Infer severity based on site"""
    high_priority = ["twitter", "facebook", "linkedin", "github", "instagram"]
    return "high" if site in high_priority else "medium"


# PhoneInfoga removed - endpoint deleted


# PhoneInfoga removed

@app.route("/holehe/scan", methods=["POST"])
def start_holehe_scan():
    """Start a Holehe scan"""
    data = request.get_json()
    print(f"[POST /holehe/scan] received body: {data}")
    
    email = data.get("email")
    if not email or not isinstance(email, str):
        print("[POST /holehe/scan] invalid body -> 400")
        return jsonify({"error": "missing email"}), 400
    
    # Generate unique job ID
    job_id = datetime.now().strftime("%s%f")
    
    # Create job with buffer queue
    job_buffer = queue.Queue()
    jobs[job_id] = {"buffer": job_buffer}
    
    # Start scan in background thread
    thread = threading.Thread(target=run_holehe_scan, args=(job_id, email, job_buffer))
    thread.daemon = True
    thread.start()
    
    print(f"[POST /holehe/scan] respond -> {{ jobId: \"{job_id}\" }}")
    return jsonify({"jobId": job_id})


def run_holehe_scan(job_id, email, job_buffer):
    """Run holehe scan in background thread"""
    
    def push(msg_type, payload):
        """Push message to SSE stream"""
        import json
        msg = json.dumps({"type": msg_type, **payload})
        job_buffer.put(msg)
        print(f"[SSE][job {job_id}] -> {msg}")
    
    try:
        # Find holehe executable
        holehe_bin = find_command("holehe")
        
        if not holehe_bin:
            push("log", {"text": "ERROR: holehe not found. Please install: pip install holehe"})
            push("done", {})
            return
        
        # Build command - use --only-used to show only sites where email is registered
        args = [holehe_bin, email, "--only-used", "--no-color"]
        
        print(f"[spawn] {' '.join(args)}")
        
        # Run holehe
        process = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Track found sites
        found_sites = []
        
        # Read both stdout and stderr line by line
        import select
        while True:
            # Check if process is done
            if process.poll() is not None:
                break
                
            # Read any available output
            line = process.stdout.readline()
            if line:
                line = line.strip()
                print(f"[holehe output] {line}")
                
                # Parse holehe output: [+] site_name or site_name (without [+])
                # Holehe sometimes outputs just the site name without [+]
                if line.startswith('[+]'):
                    site = line[3:].strip()
                    site_lc = site.lower()
                    # Skip legend/header or noisy lines
                    if ('email used' in site_lc) or ('not used' in site_lc) or ('rate limit' in site_lc):
                        continue
                    # Skip if it's the email address itself
                    if '@' in site:
                        continue
                    # Only accept domain-ish or slug names without spaces/brackets
                    import re
                    if re.match(r'^[A-Za-z0-9._-]{2,50}$', site) or ('.' in site and ' ' not in site and '[' not in site and ']' not in site):
                        if site not in found_sites:
                            found_sites.append(site)
                            # Send result immediately
                            item = {
                                "id": f"site:{site}",
                                "type": "site",
                                "value": site,
                                "email": email,
                            }
                            push("result", {"item": item})
                # Also capture lines that look like site names (lowercase with possible dots/dashes)
                elif line and not line.startswith('[') and not line.startswith('For ') and not line.startswith('*') and not '%' in line:
                    # Skip if it's the email address itself
                    if '@' in line:
                        continue
                    # Check if it's a valid site name pattern
                    if line and len(line) < 50 and not ' ' in line and ('.' in line or line.islower()):
                        ll = line.lower()
                        if ('email used' in ll) or ('not used' in ll) or ('rate limit' in ll):
                            continue
                        if line not in found_sites and line not in ['twitter', 'github']:
                            found_sites.append(line)
                            
                            # Send result immediately
                            item = {
                                "id": f"site:{line}",
                                "type": "site",
                                "value": line,
                                "email": email,
                            }
                            push("result", {"item": item})
        
        # Read any remaining output
        remaining = process.stdout.read()
        if remaining:
            for line in remaining.split('\n'):
                line = line.strip()
                if line.startswith('[+]'):
                    site = line[3:].strip()
                    site_lc = site.lower()
                    if ('email used' in site_lc) or ('not used' in site_lc) or ('rate limit' in site_lc):
                        continue
                    import re
                    if (re.match(r'^[A-Za-z0-9._-]{2,50}$', site) or ('.' in site and ' ' not in site)) and site not in found_sites:
                        found_sites.append(site)
                        item = {
                            "id": f"site:{site}",
                            "type": "site",
                            "value": site,
                            "email": email,
                        }
                        push("result", {"item": item})
        
        # Wait for completion
        return_code = process.wait()
        print(f"[spawn close][job {job_id}] code={return_code}")
        
        # Send final summary
        if len(found_sites) > 0:
            push("log", {"text": f"✅ Scan complete: Found email registered on {len(found_sites)} site(s)"})
        else:
            push("log", {"text": "✅ Scan complete: Email not found on any of the 120+ sites checked"})
    
    except Exception as e:
        print(f"[ERROR][job {job_id}] {str(e)}")
        push("log", {"text": f"Error: {str(e)}"})
    
    finally:
        # Signal completion
        push("done", {})
        job_buffer.put(None)  # Sentinel


def find_command(cmd):
    """Find command in PATH"""
    import shutil
    return shutil.which(cmd)


@app.route("/maigret/scan", methods=["POST"])
def start_maigret_scan():
    """Start a Maigret scan"""
    data = request.get_json()
    print(f"[POST /maigret/scan] received body: {data}")
    
    username = data.get("username")
    if not username or not isinstance(username, str):
        print("[POST /maigret/scan] invalid body -> 400")
        return jsonify({"error": "missing username"}), 400
    
    # Generate unique job ID
    job_id = datetime.now().strftime("%s%f")
    
    # Create job with buffer queue
    job_buffer = queue.Queue()
    jobs[job_id] = {"buffer": job_buffer}
    
    # Start scan in background thread
    print(f"[DEBUG] Creating thread for job {job_id}")
    thread = threading.Thread(target=run_maigret_scan, args=(job_id, username, job_buffer))
    thread.daemon = True
    print(f"[DEBUG] Starting thread...")
    thread.start()
    print(f"[DEBUG] Thread started, is_alive: {thread.is_alive()}")
    
    print(f"[POST /maigret/scan] respond -> {{ jobId: \"{job_id}\" }}")
    return jsonify({"jobId": job_id})


def run_maigret_scan(job_id, username, job_buffer):
    """Run maigret scan in background thread"""
    print(f"[DEBUG] run_maigret_scan started for job {job_id}, username: {username}")
    
    def push(msg_type, payload):
        """Push message to SSE stream"""
        import json
        msg = json.dumps({"type": msg_type, **payload})
        job_buffer.put(msg)
        print(f"[SSE][job {job_id}] -> {msg}")
    
    print(f"[DEBUG] push function defined")
    try:
        print(f"[DEBUG] Entering try block")
        # Find maigret executable
        maigret_bin = find_command("maigret")
        
        if not maigret_bin:
            push("log", {"text": "ERROR: maigret not found. Please install: pip install maigret"})
            push("done", {})
            return
        
        # Create temp directory for output
        work_dir = tempfile.mkdtemp(prefix="maigret_")
        
        # Build command - search for username across sites
        # Use -J ndjson for streaming JSON output that we can capture
        # --no-color to avoid ANSI codes in output
        # -a to use all sites, increasing coverage
        args = [maigret_bin, username, "--timeout", "30", "-a", "-J", "ndjson", "--no-color"]
        
        print(f"[spawn] {' '.join(args)}")
        push("log", {"text": f"Starting Maigret scan for username: {username}"})
        
        # Run maigret
        process = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Track found sites and emit stderr logs for visibility
        found_sites = set()
        
        # Read output line by line - with --json ndjson, each line is a JSON object
        while True:
            # Check if process is done
            if process.poll() is not None:
                break
                
            # Read any available output
            line = process.stdout.readline()
            if line:
                line = line.strip()
                if line:
                    print(f"[maigret output] {line}")
                    
                    # Try to parse as JSON (ndjson format)
                    try:
                        import json
                        data = json.loads(line)
                        
                        # Check if this is a found result
                        # Maigret ndjson format: {"site": "SiteName", "url": "...", "status": {...}}
                        if isinstance(data, dict):
                            site_name = data.get('site') or data.get('sitename') or data.get('name')
                            url = data.get('url') or data.get('url_user') or data.get('link')
                            status = data.get('status', {})
                            
                            # Check if profile was found
                            is_found = False
                            if isinstance(status, dict):
                                # Status might have 'status' or 'exists' field
                                status_val = str(status.get('status', '')).lower()
                                exists_val = str(status.get('exists', '')).lower()
                                is_found = 'claimed' in status_val or 'found' in status_val or exists_val == 'true'
                            elif url and url.startswith('http'):
                                is_found = True
                            
                            if is_found and site_name and url and site_name not in found_sites:
                                found_sites.add(site_name)
                                print(f"[DEBUG] Found site: {site_name} -> {url}")
                                
                                # Send result immediately
                                item = {
                                    "id": f"site:{site_name}",
                                    "type": "site",
                                    "value": site_name,
                                    "url": url,
                                }
                                push("result", {"item": item})
                    except json.JSONDecodeError:
                        # Not JSON, might be progress message; try fallback parser "[+] Site: URL"
                        if line.startswith('[+]') and ':' in line:
                            try:
                                after = line[3:].strip()
                                site_part, url_part = after.split(':', 1)
                                site_name = site_part.strip()
                                url = url_part.strip().split()[0]
                                if site_name and url.startswith('http') and site_name not in found_sites:
                                    found_sites.add(site_name)
                                    item = {"id": f"site:{site_name}", "type": "site", "value": site_name, "url": url}
                                    push("result", {"item": item})
                            except Exception:
                                pass
        
        # Read and log any stderr (errors/progress)
        try:
            for err_line in process.stderr:
                err_line = err_line.strip()
                if err_line:
                    print(f"[maigret stderr] {err_line}")
                    push("log", {"text": err_line})
        except Exception:
            pass

        # Read any remaining output
        remaining = process.stdout.read()
        if remaining:
            for line in remaining.split('\n'):
                line = line.strip()
                if line:
                    print(f"[maigret output] {line}")
                    try:
                        import json
                        data = json.loads(line)
                        if isinstance(data, dict):
                            site_name = data.get('site') or data.get('sitename') or data.get('name')
                            url = data.get('url') or data.get('url_user') or data.get('link')
                            status = data.get('status', {})
                            
                            is_found = False
                            if isinstance(status, dict):
                                status_val = str(status.get('status', '')).lower()
                                exists_val = str(status.get('exists', '')).lower()
                                is_found = 'claimed' in status_val or 'found' in status_val or exists_val == 'true'
                            elif url and url.startswith('http'):
                                is_found = True
                            
                            if is_found and site_name and url and site_name not in found_sites:
                                found_sites.add(site_name)
                                item = {
                                    "id": f"site:{site_name}",
                                    "type": "site",
                                    "value": site_name,
                                    "url": url,
                                }
                                push("result", {"item": item})
                    except:
                        pass
        
        # Wait for completion
        return_code = process.wait()
        print(f"[spawn close][job {job_id}] code={return_code}, found {len(found_sites)} sites")
        
        # Clean up temp directory
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)
        
        # Send final summary
        if len(found_sites) > 0:
            push("log", {"text": f"✅ Scan complete: Found username on {len(found_sites)} site(s)"})
        else:
            push("log", {"text": "✅ Scan complete: Username not found on any of the 2000+ sites checked"})
    
    except Exception as e:
        print(f"[ERROR][job {job_id}] {str(e)}")
        push("log", {"text": f"Error: {str(e)}"})
    
    finally:
        # Signal completion
        push("done", {})
        job_buffer.put(None)  # Sentinel


@app.route("/harvester/scan", methods=["POST"])
def start_harvester_scan():
    """Start a theHarvester scan"""
    data = request.get_json()
    print(f"[POST /harvester/scan] received body: {data}")
    
    domain = data.get("domain")
    if not domain or not isinstance(domain, str):
        print("[POST /harvester/scan] invalid body -> 400")
        return jsonify({"error": "missing domain"}), 400
    
    # Get advanced options
    options = {
        "dns_resolve": data.get("dnsResolve", False),
        "dns_brute": data.get("dnsBrute", False),
        "sources": data.get("sources", "crtsh,hackertarget,dnsdumpster,virustotal,otx,rapiddns")
    }
    
    # Generate unique job ID
    job_id = datetime.now().strftime("%s%f")
    
    # Create job with buffer queue
    job_buffer = queue.Queue()
    jobs[job_id] = {"buffer": job_buffer}
    
    # Start scan in background thread
    thread = threading.Thread(target=run_harvester_scan, args=(job_id, domain, job_buffer, options))
    thread.daemon = True
    thread.start()
    
    print(f"[POST /harvester/scan] respond -> {{ jobId: \"{job_id}\" }}")
    return jsonify({"jobId": job_id})


def run_harvester_scan(job_id, domain, job_buffer, options=None):
    """Run theHarvester scan in background thread"""
    
    if options is None:
        options = {
            "dns_resolve": False,
            "dns_brute": False,
            "sources": "crtsh,hackertarget,dnsdumpster"
        }
    
    def push(msg_type, payload):
        """Push message to SSE stream"""
        import json
        msg = json.dumps({"type": msg_type, **payload})
        job_buffer.put(msg)
        print(f"[SSE][job {job_id}] -> {msg}")
    
    # Create temporary directory for output
    work_dir = tempfile.mkdtemp(prefix="harvester-")
    output_file = os.path.join(work_dir, "results.json")
    
    try:
        # Find theHarvester executable
        harvester_bin = find_harvester()
        
        if not harvester_bin:
            push("log", {"text": "ERROR: theHarvester not found. Please install: pip install theHarvester"})
            push("done", {})
            return
        
        # Build command - use free sources that don't require API keys
        args = [
            harvester_bin,
            "-d", domain,
            "-b", options["sources"],
            "-f", output_file,
            "-l", "200"  # Increased limit for more results
        ]
        
        # Add DNS resolution if enabled
        if options.get("dns_resolve"):
            args.append("-n")
            push("log", {"text": "DNS resolution enabled"})
        
        # Add DNS brute force if enabled
        if options.get("dns_brute"):
            args.append("-c")
            push("log", {"text": "DNS brute force enabled (this may take longer)"})
        
        # Always quiet mode to suppress API warnings
        args.append("-q")
        
        print(f"[spawn] {' '.join(args)}  (cwd={work_dir})")
        
        # Run theHarvester
        process = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=work_dir,
            text=True,
            bufsize=1
        )
        
        # Stream stdout
        def read_stream(stream, label):
            for line in iter(stream.readline, ''):
                if line:
                    push("log", {"text": line.rstrip()})
        
        # Create threads to read stdout/stderr
        stdout_thread = threading.Thread(target=read_stream, args=(process.stdout, "stdout"))
        stderr_thread = threading.Thread(target=read_stream, args=(process.stderr, "stderr"))
        stdout_thread.daemon = True
        stderr_thread.daemon = True
        stdout_thread.start()
        stderr_thread.start()
        
        # Wait for completion
        return_code = process.wait()
        
        # Give threads a moment to finish reading
        stdout_thread.join(timeout=2)
        stderr_thread.join(timeout=2)
        
        print(f"[spawn close][job {job_id}] code={return_code}")
        
        # Small delay to ensure file is written
        time.sleep(0.5)
        
        # Parse JSON results - theHarvester automatically appends .json to the filename
        json_path = output_file + ".json"
        
        # Also check if results were written without the extra .json
        if not os.path.exists(json_path) and os.path.exists(output_file):
            json_path = output_file
        
        if os.path.exists(json_path):
            print(f"[parse][job {job_id}] Found JSON at {json_path}, parsing...")
            parse_harvester_results(json_path, domain, push)
            print(f"[parse][job {job_id}] JSON parsing complete")
        else:
            print(f"[parse][job {job_id}] No results file found. Checked: {json_path} and {output_file}")
            push("log", {"text": f"No results file produced. Check if domain '{domain}' exists."})
    
    except Exception as e:
        print(f"[ERROR][job {job_id}] {str(e)}")
        push("log", {"text": f"Error: {str(e)}"})
    
    finally:
        # Cleanup temp directory
        try:
            import shutil
            shutil.rmtree(work_dir)
        except Exception as e:
            print(f"[cleanup][job {job_id}] {str(e)}")
        
        # Signal completion
        push("done", {})
        job_buffer.put(None)  # Sentinel


def find_harvester():
    """Find theHarvester executable"""
    # Try common locations
    locations = [
        "/Library/Frameworks/Python.framework/Versions/3.13/bin/theHarvester",
        "/usr/local/bin/theHarvester",
        "theHarvester"  # Try PATH
    ]
    
    for loc in locations:
        if os.path.exists(loc):
            return loc
    
    # Try 'which theHarvester'
    try:
        result = subprocess.run(["which", "theHarvester"], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except:
        pass
    
    return None


def parse_harvester_results(json_path, domain, push):
    """Parse theHarvester JSON and send results"""
    try:
        import json
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Track unique IPs
        seen_ips = set()
        
        # Extract emails
        emails = data.get("emails", [])
        for email in emails:
            item = {
                "id": f"email:{email}",
                "type": "email",
                "value": email,
                "domain": domain,
            }
            push("result", {"item": item})
        
        # Extract hosts/subdomains
        # theHarvester may format as "host:ip" when DNS resolution is enabled
        hosts = data.get("hosts", [])
        for host_entry in hosts:
            # Split host:ip format
            if ':' in host_entry:
                parts = host_entry.split(':', 1)
                host = parts[0]
                ip = parts[1] if len(parts) > 1 else None
                
                # Send host
                item = {
                    "id": f"host:{host}",
                    "type": "host",
                    "value": host,
                    "domain": domain,
                }
                push("result", {"item": item})
                
                # Send IP if present and not seen
                if ip and ip not in seen_ips:
                    seen_ips.add(ip)
                    item = {
                        "id": f"ip:{ip}",
                        "type": "ip",
                        "value": ip,
                        "domain": domain,
                    }
                    push("result", {"item": item})
            else:
                # Just a host without IP
                item = {
                    "id": f"host:{host_entry}",
                    "type": "host",
                    "value": host_entry,
                    "domain": domain,
                }
                push("result", {"item": item})
        
        # Extract IPs from dedicated ips array (if present)
        ips = data.get("ips", [])
        for ip in ips:
            if ip not in seen_ips:
                seen_ips.add(ip)
                item = {
                    "id": f"ip:{ip}",
                    "type": "ip",
                    "value": ip,
                    "domain": domain,
                }
                push("result", {"item": item})
        
        push("log", {"text": f"Parsing complete: {len(emails)} emails, {len(hosts)} hosts, {len(seen_ips)} IPs"})
    
    except Exception as e:
        push("log", {"text": f"Error parsing JSON: {str(e)}"})


def extract_thumbnails(file_path, temp_dir):
    """Extract thumbnail and preview images from file"""
    thumbnails = []
    try:
        # Try to extract ThumbnailImage
        thumb_path = os.path.join(temp_dir, "thumbnail.jpg")
        result = subprocess.run(
            ["exiftool", "-b", "-ThumbnailImage", file_path],
            capture_output=True,
            timeout=10
        )
        if result.returncode == 0 and len(result.stdout) > 0:
            with open(thumb_path, 'wb') as f:
                f.write(result.stdout)
            # Convert to base64 for frontend
            import base64
            thumbnails.append({
                "type": "Thumbnail",
                "data": base64.b64encode(result.stdout).decode('utf-8')
            })
            print(f"[extract_thumbnails] Extracted thumbnail ({len(result.stdout)} bytes)")
        
        # Try to extract PreviewImage
        preview_path = os.path.join(temp_dir, "preview.jpg")
        result = subprocess.run(
            ["exiftool", "-b", "-PreviewImage", file_path],
            capture_output=True,
            timeout=10
        )
        if result.returncode == 0 and len(result.stdout) > 0:
            import base64
            thumbnails.append({
                "type": "Preview",
                "data": base64.b64encode(result.stdout).decode('utf-8')
            })
            print(f"[extract_thumbnails] Extracted preview ({len(result.stdout)} bytes)")
    except Exception as e:
        print(f"[extract_thumbnails] error: {str(e)}")
    
    return thumbnails


def generate_file_hashes(file_path):
    """Generate MD5 and SHA256 hashes of the file"""
    import hashlib
    hashes = {}
    try:
        md5_hash = hashlib.md5()
        sha256_hash = hashlib.sha256()
        
        with open(file_path, 'rb') as f:
            # Read file in chunks for memory efficiency
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
                sha256_hash.update(chunk)
        
        hashes['MD5'] = md5_hash.hexdigest()
        hashes['SHA256'] = sha256_hash.hexdigest()
        print(f"[generate_file_hashes] MD5={hashes['MD5']}, SHA256={hashes['SHA256'][:16]}...")
    except Exception as e:
        print(f"[generate_file_hashes] error: {str(e)}")
    
    return hashes


def verify_file_type(file_path, filename):
    """Verify if file extension matches actual file type"""
    verification = {
        "extensionMatches": True,
        "warning": None,
        "declaredType": None,
        "actualType": None
    }
    
    try:
        # Get file extension
        ext = os.path.splitext(filename)[1].lower()
        verification['declaredType'] = ext
        
        # Get actual file type from exiftool
        result = subprocess.run(
            ["exiftool", "-FileType", "-MIMEType", "-s3", file_path],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 1:
                actual_type = lines[0].strip().lower()
                verification['actualType'] = actual_type
                
                # Check if extension matches file type
                common_mappings = {
                    '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.gif': 'gif',
                    '.bmp': 'bmp', '.tiff': 'tiff', '.tif': 'tiff',
                    '.pdf': 'pdf', '.doc': 'doc', '.docx': 'docx',
                    '.mp4': 'mp4', '.mov': 'mov', '.avi': 'avi',
                    '.mp3': 'mp3', '.wav': 'wav', '.m4a': 'm4a'
                }
                
                expected_type = common_mappings.get(ext)
                if expected_type and expected_type != actual_type:
                    verification['extensionMatches'] = False
                    verification['warning'] = f"File extension '{ext}' does not match actual file type '{actual_type}'. This could indicate file spoofing or renaming."
                    print(f"[verify_file_type] WARNING: Extension mismatch - declared: {ext}, actual: {actual_type}")
    
    except Exception as e:
        print(f"[verify_file_type] error: {str(e)}")
    
    return verification


def extract_gps_data(metadata):
    """Extract and parse GPS coordinates from metadata"""
    gps_data = {
        "hasGPS": False,
        "latitude": None,
        "longitude": None,
        "altitude": None,
        "mapUrl": None
    }
    
    try:
        # Look for GPS fields
        lat_keys = ['GPS:GPSLatitude', 'EXIF:GPSLatitude', 'Composite:GPSLatitude']
        lon_keys = ['GPS:GPSLongitude', 'EXIF:GPSLongitude', 'Composite:GPSLongitude']
        alt_keys = ['GPS:GPSAltitude', 'EXIF:GPSAltitude', 'Composite:GPSAltitude']
        
        for key in lat_keys:
            if key in metadata:
                gps_data['latitude'] = str(metadata[key])
                gps_data['hasGPS'] = True
                break
        
        for key in lon_keys:
            if key in metadata:
                gps_data['longitude'] = str(metadata[key])
                break
        
        for key in alt_keys:
            if key in metadata:
                gps_data['altitude'] = str(metadata[key])
                break
        
        # Generate map URL if we have coordinates
        if gps_data['hasGPS'] and gps_data['latitude'] and gps_data['longitude']:
            # Convert DMS to decimal if needed (simplified)
            lat_str = gps_data['latitude'].replace('deg', '').replace("'", '').replace('"', '').replace('N', '').replace('S', '').strip()
            lon_str = gps_data['longitude'].replace('deg', '').replace("'", '').replace('"', '').replace('E', '').replace('W', '').strip()
            gps_data['mapUrl'] = f"https://www.openstreetmap.org/?mlat={lat_str}&mlon={lon_str}&zoom=15"
            print(f"[extract_gps_data] GPS found: {lat_str}, {lon_str}")
    
    except Exception as e:
        print(f"[extract_gps_data] error: {str(e)}")
    
    return gps_data


def analyze_timestamps(metadata):
    """Analyze file timestamps for discrepancies"""
    analysis = {
        "timestamps": {},
        "warnings": []
    }
    
    try:
        # Collect all timestamp fields
        timestamp_keys = [
            'File:FileModifyDate', 'File:FileAccessDate', 'File:FileCreateDate',
            'EXIF:CreateDate', 'EXIF:ModifyDate', 'EXIF:DateTimeOriginal',
            'XMP:CreateDate', 'XMP:ModifyDate', 'QuickTime:CreateDate', 'QuickTime:ModifyDate'
        ]
        
        for key in timestamp_keys:
            if key in metadata:
                analysis['timestamps'][key] = str(metadata[key])
        
        # Check for discrepancies
        if 'EXIF:DateTimeOriginal' in analysis['timestamps'] and 'File:FileModifyDate' in analysis['timestamps']:
            # Simplified check - in real implementation would parse dates properly
            if analysis['timestamps']['EXIF:DateTimeOriginal'] != analysis['timestamps']['File:FileModifyDate']:
                analysis['warnings'].append("File modification date differs from original creation date - file may have been edited or metadata modified")
        
        # Check if metadata dates are newer than file dates
        if len(analysis['timestamps']) > 1:
            analysis['warnings'].append(f"Found {len(analysis['timestamps'])} different timestamps - review for consistency")
        
        print(f"[analyze_timestamps] Found {len(analysis['timestamps'])} timestamps, {len(analysis['warnings'])} warnings")
    
    except Exception as e:
        print(f"[analyze_timestamps] error: {str(e)}")
    
    return analysis


def extract_device_info(metadata):
    """Extract camera/device information"""
    device_info = {}
    
    try:
        # Device/Camera fields
        device_keys = {
            'make': ['EXIF:Make', 'IFD0:Make'],
            'model': ['EXIF:Model', 'IFD0:Model'],
            'software': ['EXIF:Software', 'IFD0:Software', 'XMP:CreatorTool'],
            'lensModel': ['EXIF:LensModel', 'XMP:LensModel'],
            'serialNumber': ['EXIF:SerialNumber', 'MakerNotes:SerialNumber'],
            'internalSerialNumber': ['MakerNotes:InternalSerialNumber']
        }
        
        for field, keys in device_keys.items():
            for key in keys:
                if key in metadata:
                    device_info[field] = str(metadata[key])
                    break
        
        if device_info:
            print(f"[extract_device_info] Extracted device info: {device_info.get('make', 'Unknown')} {device_info.get('model', 'Unknown')}")
    
    except Exception as e:
        print(f"[extract_device_info] error: {str(e)}")
    
    return device_info


def get_file_stats(file_path):
    """Get file size and other stats"""
    stats = {}
    try:
        file_stats = os.stat(file_path)
        stats['size'] = file_stats.st_size
        stats['sizeHuman'] = format_bytes(file_stats.st_size)
        stats['modified'] = datetime.fromtimestamp(file_stats.st_mtime).isoformat()
        stats['created'] = datetime.fromtimestamp(file_stats.st_ctime).isoformat()
    except Exception as e:
        print(f"[get_file_stats] error: {str(e)}")
    
    return stats


def format_bytes(size):
    """Format bytes to human readable"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} TB"


@app.route("/exiftool/analyze", methods=["POST"])
def analyze_file():
    """Analyze file metadata using ExifTool with comprehensive features"""
    print("[POST /exiftool/analyze] received file upload request")
    
    # Check if file is present
    if 'file' not in request.files:
        print("[POST /exiftool/analyze] no file in request -> 400")
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    # Check if filename is empty
    if file.filename == '':
        print("[POST /exiftool/analyze] empty filename -> 400")
        return jsonify({"error": "No file selected"}), 400
    
    # Create temporary file
    temp_dir = tempfile.mkdtemp(prefix="exiftool-")
    
    try:
        # Save uploaded file
        safe_filename = os.path.basename(file.filename)
        temp_path = os.path.join(temp_dir, safe_filename)
        file.save(temp_path)
        print(f"[POST /exiftool/analyze] saved file to {temp_path}")
        
        # 1. Extract basic metadata
        result = subprocess.run(
            ["exiftool", "-json", "-a", "-G", temp_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"[POST /exiftool/analyze] exiftool error: {result.stderr}")
            return jsonify({"error": f"ExifTool error: {result.stderr}"}), 500
        
        import json
        metadata = json.loads(result.stdout)
        metadata_dict = metadata[0] if metadata else {}
        
        # 2. Extract thumbnails
        thumbnails = extract_thumbnails(temp_path, temp_dir)
        
        # 3. Generate file hashes
        hashes = generate_file_hashes(temp_path)
        
        # 4. Verify file type
        file_verification = verify_file_type(temp_path, safe_filename)
        
        # 5. Analyze GPS data
        gps_data = extract_gps_data(metadata_dict)
        
        # 6. Analyze timestamps
        timestamp_analysis = analyze_timestamps(metadata_dict)
        
        # 7. Extract device info
        device_info = extract_device_info(metadata_dict)
        
        # 8. Get file stats
        file_stats = get_file_stats(temp_path)
        
        print(f"[POST /exiftool/analyze] extracted {len(metadata_dict)} metadata fields")
        
        return jsonify({
            "success": True,
            "filename": safe_filename,
            "metadata": metadata_dict,
            "thumbnails": thumbnails,
            "hashes": hashes,
            "fileVerification": file_verification,
            "gpsData": gps_data,
            "timestampAnalysis": timestamp_analysis,
            "deviceInfo": device_info,
            "fileStats": file_stats
        })
    
    except subprocess.TimeoutExpired:
        print("[POST /exiftool/analyze] timeout")
        return jsonify({"error": "Processing timeout"}), 500
    
    except Exception as e:
        print(f"[POST /exiftool/analyze] error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
    finally:
        # Cleanup temp directory
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception as e:
            print(f"[cleanup] {str(e)}")


@app.route("/exiftool/batch-analyze", methods=["POST"])
def batch_analyze_files():
    """Analyze multiple files at once"""
    print("[POST /exiftool/batch-analyze] received batch upload request")
    
    # Get all uploaded files
    files = request.files.getlist('files')
    
    if not files or len(files) == 0:
        return jsonify({"error": "No files provided"}), 400
    
    if len(files) > 20:
        return jsonify({"error": "Maximum 20 files allowed"}), 400
    
    results = []
    temp_dir = tempfile.mkdtemp(prefix="exiftool-batch-")
    
    try:
        for file in files:
            if file.filename == '':
                continue
            
            try:
                # Save uploaded file
                safe_filename = os.path.basename(file.filename)
                temp_path = os.path.join(temp_dir, safe_filename)
                file.save(temp_path)
                
                # Extract basic metadata
                result = subprocess.run(
                    ["exiftool", "-json", "-a", "-G", temp_path],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode != 0:
                    results.append({
                        "filename": safe_filename,
                        "error": f"ExifTool error: {result.stderr}",
                        "success": False
                    })
                    continue
                
                import json
                metadata = json.loads(result.stdout)
                metadata_dict = metadata[0] if metadata else {}
                
                # Extract all features for each file
                thumbnails = extract_thumbnails(temp_path, temp_dir)
                hashes = generate_file_hashes(temp_path)
                file_verification = verify_file_type(temp_path, safe_filename)
                gps_data = extract_gps_data(metadata_dict)
                timestamp_analysis = analyze_timestamps(metadata_dict)
                device_info = extract_device_info(metadata_dict)
                file_stats = get_file_stats(temp_path)
                
                results.append({
                    "success": True,
                    "filename": safe_filename,
                    "metadata": metadata_dict,
                    "thumbnails": thumbnails,
                    "hashes": hashes,
                    "fileVerification": file_verification,
                    "gpsData": gps_data,
                    "timestampAnalysis": timestamp_analysis,
                    "deviceInfo": device_info,
                    "fileStats": file_stats
                })
                
            except Exception as e:
                results.append({
                    "filename": file.filename,
                    "error": str(e),
                    "success": False
                })
        
        return jsonify({
            "success": True,
            "count": len(results),
            "results": results
        })
    
    except Exception as e:
        print(f"[POST /exiftool/batch-analyze] error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
    finally:
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception as e:
            print(f"[cleanup] {str(e)}")


@app.route("/exiftool/hex-dump", methods=["POST"])
def get_hex_dump():
    """Get hex dump of file for binary analysis"""
    print("[POST /exiftool/hex-dump] received request")
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Get optional parameters
    offset = int(request.form.get('offset', 0))
    length = int(request.form.get('length', 1024))  # Default 1KB
    
    # Limit maximum length to 10KB to avoid performance issues
    length = min(length, 10240)
    
    temp_dir = tempfile.mkdtemp(prefix="exiftool-hex-")
    
    try:
        # Save uploaded file
        safe_filename = os.path.basename(file.filename)
        temp_path = os.path.join(temp_dir, safe_filename)
        file.save(temp_path)
        
        # Get file size
        file_size = os.path.getsize(temp_path)
        
        # Read binary data
        with open(temp_path, 'rb') as f:
            f.seek(offset)
            data = f.read(length)
        
        # Convert to hex dump format
        hex_lines = []
        for i in range(0, len(data), 16):
            chunk = data[i:i+16]
            hex_part = ' '.join(f'{b:02x}' for b in chunk)
            ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            address = offset + i
            hex_lines.append({
                "address": f"{address:08x}",
                "hex": hex_part,
                "ascii": ascii_part
            })
        
        return jsonify({
            "success": True,
            "filename": safe_filename,
            "fileSize": file_size,
            "offset": offset,
            "length": len(data),
            "hexDump": hex_lines
        })
    
    except Exception as e:
        print(f"[POST /exiftool/hex-dump] error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
    finally:
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception as e:
            print(f"[cleanup] {str(e)}")


@app.route("/exiftool/remove-metadata", methods=["POST"])
def remove_metadata():
    """Remove all metadata from a file"""
    print("[POST /exiftool/remove-metadata] received request")
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    temp_dir = tempfile.mkdtemp(prefix="exiftool-clean-")
    
    try:
        # Save uploaded file
        safe_filename = os.path.basename(file.filename)
        temp_path = os.path.join(temp_dir, safe_filename)
        file.save(temp_path)
        
        # Create output filename
        name, ext = os.path.splitext(safe_filename)
        clean_filename = f"{name}_clean{ext}"
        clean_path = os.path.join(temp_dir, clean_filename)
        
        # Remove all metadata
        result = subprocess.run(
            ["exiftool", "-all=", "-o", clean_path, temp_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            return jsonify({"error": f"ExifTool error: {result.stderr}"}), 500
        
        # Read the cleaned file
        with open(clean_path, 'rb') as f:
            clean_data = f.read()
        
        import base64
        return jsonify({
            "success": True,
            "filename": clean_filename,
            "data": base64.b64encode(clean_data).decode('utf-8'),
            "size": len(clean_data),
            "message": "All metadata has been removed from the file"
        })
    
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Processing timeout"}), 500
    
    except Exception as e:
        print(f"[POST /exiftool/remove-metadata] error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
    finally:
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception as e:
            print(f"[cleanup] {str(e)}")


@app.route("/ai/analyze", methods=["POST"])
def ai_analyze():
    """Analyze text/image using local Ollama AI model"""
    try:
        message = request.form.get('message', '')
        image_file = request.files.get('image')
        
        # Check if Ollama is available
        try:
            # Check if ollama command exists
            ollama_check = subprocess.run(
                ['which', 'ollama'],
                capture_output=True,
                text=True
            )
            
            if ollama_check.returncode != 0:
                return jsonify({
                    "error": "Ollama not found",
                    "response": "❌ Ollama is not installed on your system.\n\n📦 Installation Steps:\n\n1. Visit: https://ollama.com\n2. Download Ollama for macOS\n3. Install and open Ollama\n4. Run in Terminal:\n   ollama pull llama3.2\n   ollama pull llama3.2-vision\n\n5. Return here and try again!\n\nℹ️ Ollama runs locally for complete privacy - no data leaves your machine."
                }), 200
            
            # Check if Ollama server is running
            try:
                import requests
                server_check = requests.get('http://localhost:11434/api/tags', timeout=2)
                if server_check.status_code != 200:
                    return jsonify({
                        "error": "Ollama not running",
                        "response": "⚠️ Ollama is installed but not running.\n\n▶️ Please start Ollama:\n\n1. Open the Ollama app from Applications\n2. Wait for the menu bar icon to appear\n3. Return here and try again\n\nℹ️ Ollama needs to be running in the background to process requests."
                    }), 200
            except:
                return jsonify({
                    "error": "Ollama not running",
                    "response": "⚠️ Cannot connect to Ollama server.\n\n▶️ Please start Ollama:\n\n1. Open the Ollama app from Applications\n2. Wait for the menu bar icon to appear\n3. Or run in Terminal: ollama serve\n4. Return here and try again\n\nℹ️ Ollama needs to be running in the background to process requests."
                }), 200
            
            # First, check if the query contains data/findings to analyze
            relevance_check = """You are an analysis filter. Determine if the following input contains OSINT findings, data, or information that needs analysis (like usernames, emails, URLs, social media profiles, search results, metadata, etc.).

Respond with ONLY "HAS_DATA" or "NO_DATA" - nothing else.

Input: """ + message
            
            # Check if there's actual data to analyze
            import json
            relevance_response = subprocess.run(
                ['curl', '-s', '-X', 'POST', 'http://localhost:11434/api/generate', 
                 '-H', 'Content-Type: application/json',
                 '-d', json.dumps({
                     'model': 'llama3.2',
                     'prompt': relevance_check,
                     'stream': False
                 })],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if relevance_response.returncode == 0:
                try:
                    relevance_data = json.loads(relevance_response.stdout)
                    relevance_result = relevance_data.get('response', '').strip().upper()
                    
                    if 'NO_DATA' in relevance_result or 'NO DATA' in relevance_result:
                        return jsonify({
                            "response": "Please provide findings or data to analyze. Paste results from other tools (Maigret, Holehe, TheHarvester, ExifTool, etc.) or provide information you want me to correlate and analyze for patterns, connections, or investigation leads."
                        }), 200
                except:
                    pass  # Continue if relevance check fails
            
            # Prepare the analysis prompt
            osint_prompt = """You are a professional OSINT analysis engine. Your role is to analyze existing findings and data to identify patterns, connections, and additional investigation avenues.

Analysis Guidelines:
- Identify patterns and correlations in the provided data
- Highlight suspicious or notable connections
- Suggest additional investigation steps based on findings
- Point out gaps in the data that should be investigated
- Recommend which other OSINT tools to use next
- Be concise, direct, and professional
- No emojis or casual language
- Focus on actionable intelligence

Analyze the following: """ + message
            
            # If image is provided, save it temporarily and use vision model
            if image_file:
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
                    image_file.save(tmp_file.name)
                    tmp_image_path = tmp_file.name
                
                try:
                    # Use vision model for image analysis with proper stdin handling
                    with open(tmp_image_path, 'rb') as img_file:
                        # First, try to use the API endpoint (more reliable for images)
                        import json
                        api_response = subprocess.run(
                            ['curl', '-s', 'http://localhost:11434/api/generate', '-d',
                             json.dumps({
                                 'model': 'llama3.2-vision',
                                 'prompt': osint_prompt,
                                 'stream': False,
                                 'images': [__import__('base64').b64encode(img_file.read()).decode()]
                             })],
                            capture_output=True,
                            text=True,
                            timeout=60
                        )
                        
                        if api_response.returncode == 0:
                            try:
                                api_data = json.loads(api_response.stdout)
                                result = type('obj', (object,), {
                                    'returncode': 0,
                                    'stdout': api_data.get('response', ''),
                                    'stderr': ''
                                })()
                            except:
                                # Fallback to CLI if API fails
                                result = subprocess.run(
                                    ['ollama', 'run', 'llama3.2-vision', osint_prompt, '<', tmp_image_path],
                                    capture_output=True,
                                    text=True,
                                    timeout=60,
                                    shell=True
                                )
                        else:
                            # Fallback to CLI
                            result = subprocess.run(
                                ['ollama', 'run', 'llama3.2-vision', osint_prompt, '<', tmp_image_path],
                                capture_output=True,
                                text=True,
                                timeout=60,
                                shell=True
                            )
                finally:
                    # Clean up temp file
                    try:
                        os.unlink(tmp_image_path)
                    except:
                        pass
            else:
                # Text-only analysis using API
                import json
                api_response = subprocess.run(
                    ['curl', '-s', '-X', 'POST', 'http://localhost:11434/api/generate', 
                     '-H', 'Content-Type: application/json',
                     '-d', json.dumps({
                         'model': 'llama3.2',
                         'prompt': osint_prompt,
                         'stream': False
                     })],
                    capture_output=True,
                    text=True,
                    timeout=90
                )
                
                if api_response.returncode == 0:
                    try:
                        api_data = json.loads(api_response.stdout)
                        result = type('obj', (object,), {
                            'returncode': 0,
                            'stdout': api_data.get('response', ''),
                            'stderr': ''
                        })()
                    except Exception as e:
                        result = type('obj', (object,), {
                            'returncode': 1,
                            'stdout': '',
                            'stderr': f'Failed to parse Ollama response: {str(e)}'
                        })()
                else:
                    result = type('obj', (object,), {
                        'returncode': 1,
                        'stdout': '',
                        'stderr': 'Failed to connect to Ollama API'
                    })()
            
            if result.returncode != 0:
                error_msg = result.stderr or "Unknown error"
                if "model" in error_msg.lower() and "not found" in error_msg.lower():
                    model_needed = "llama3.2-vision" if image_file else "llama3.2"
                    return jsonify({
                        "response": f"❌ Model '{model_needed}' not found.\n\n📥 Please install the model:\n\nRun in Terminal:\n  ollama pull {model_needed}\n\nℹ️ First download may take a few minutes (models are 2-4GB).\n\nOnce complete, return here and try again!"
                    }), 200
                elif "server" in error_msg.lower() or "connect" in error_msg.lower():
                    return jsonify({
                        "response": "⚠️ Cannot connect to Ollama server.\n\n▶️ Please start Ollama:\n\n1. Open Ollama app from Applications\n2. Or run: ollama serve\n3. Try again"
                    }), 200
                else:
                    return jsonify({
                        "response": f"⚠️ Ollama error: {error_msg}\n\nℹ️ Make sure Ollama is running and models are installed:\n  ollama pull llama3.2\n  ollama pull llama3.2-vision"
                    }), 200
            
            response_text = result.stdout.strip()
            
            if not response_text:
                response_text = "I apologize, but I couldn't generate a response. Please try again."
            
            return jsonify({"response": response_text}), 200
            
        except subprocess.TimeoutExpired:
            return jsonify({
                "response": "⏱️ Request timed out. Please try a simpler query or check if Ollama is running properly."
            }), 200
            
        except Exception as e:
            print(f"[AI Error] {str(e)}")
            return jsonify({
                "response": f"⚠️ Error: {str(e)}\n\nMake sure Ollama is installed and running:\n1. Visit https://ollama.com\n2. Install Ollama\n3. Run: ollama pull llama3.2"
            }), 200
            
    except Exception as e:
        print(f"[AI Error] {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/whois/lookup", methods=["GET"])
def whois_lookup():
    """Lookup WHOIS information for a domain"""
    try:
        domain = request.args.get('domain', '').strip()
        
        if not domain:
            return jsonify({"error": "Domain parameter is required"}), 400
        
        # Run whois command
        result = subprocess.run(
            ['whois', domain],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            return jsonify({"error": "Failed to lookup domain", "details": result.stderr}), 500
        
        raw_output = result.stdout
        
        # Parse common WHOIS fields
        whois_data = {
            'domain': domain,
            'raw': raw_output
        }
        
        # Extract key information with simple parsing
        lines = raw_output.lower().split('\n')
        
        for line in lines:
            line = line.strip()
            
            # Registrar
            if 'registrar:' in line and not whois_data.get('registrar'):
                whois_data['registrar'] = line.split(':', 1)[1].strip()
            
            # Registrant
            elif 'registrant' in line and 'organization:' in line and not whois_data.get('registrant'):
                whois_data['registrant'] = line.split(':', 1)[1].strip()
            elif 'registrant organization:' in line and not whois_data.get('registrant'):
                whois_data['registrant'] = line.split(':', 1)[1].strip()
            
            # Dates
            elif 'creation date:' in line or 'created:' in line:
                if not whois_data.get('created'):
                    whois_data['created'] = line.split(':', 1)[1].strip()
            elif 'expir' in line and 'date:' in line:
                if not whois_data.get('expires'):
                    whois_data['expires'] = line.split(':', 1)[1].strip()
            elif 'updated date:' in line or 'last updated:' in line:
                if not whois_data.get('updated'):
                    whois_data['updated'] = line.split(':', 1)[1].strip()
        
        # Extract nameservers
        nameservers = []
        for line in raw_output.split('\n'):
            line_lower = line.lower().strip()
            if 'name server:' in line_lower or 'nserver:' in line_lower:
                ns = line.split(':', 1)[1].strip()
                if ns and ns not in nameservers:
                    nameservers.append(ns)
        if nameservers:
            whois_data['nameservers'] = nameservers
        
        # Extract status
        status_list = []
        for line in raw_output.split('\n'):
            line_lower = line.lower().strip()
            if 'domain status:' in line_lower or 'status:' in line_lower:
                status = line.split(':', 1)[1].strip()
                if status and status not in status_list and len(status) < 100:
                    status_list.append(status)
        if status_list:
            whois_data['status'] = status_list[:10]  # Limit to 10 status entries
        
        # Extract emails
        import re
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = list(set(re.findall(email_pattern, raw_output)))
        # Filter out common noise emails
        emails = [e for e in emails if not any(x in e.lower() for x in ['example.com', 'please', 'contact'])]
        if emails:
            whois_data['emails'] = emails[:5]  # Limit to 5 emails
        
        return jsonify(whois_data), 200
        
    except subprocess.TimeoutExpired:
        return jsonify({"error": "WHOIS lookup timed out"}), 500
    except FileNotFoundError:
        return jsonify({"error": "WHOIS command not found. Please install whois tool."}), 500
    except Exception as e:
        print(f"[WHOIS Error] {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 41234))
    print(f"[Python Backend] Starting on http://localhost:{port}")
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)

