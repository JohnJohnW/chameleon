// server.js
const { spawn } = require("child_process");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { parse } = require("csv-parse/sync"); // npm i csv-parse

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => res.type("text").send("ok"));

const jobs = new Map(); // jobId -> { buffer: string[] }

app.post("/scan", (req, res) => {
  // ---- RECEIVE: log the request body exactly as sent by the web app ----
  console.log(`[POST /scan] received body:`, req.body);

  const { query } = req.body || {};
  if (!query || typeof query !== "string") {
    console.log(`[POST /scan] invalid body -> 400`);
    return res.status(400).json({ error: "missing query" });
  }

  const jobId = Date.now().toString(36);
  const buffer = [];
  jobs.set(jobId, { buffer });

  // helper that both buffers SSE messages and logs them
  const push = (type, payload) => {
    const msg = JSON.stringify({ type, ...payload });
    buffer.push(msg + "\n");
    // ---- SEND: log every SSE message we are about to send ----
    console.log(`[SSE][job ${jobId}] -> ${msg}`);
  };

  // temp working directory for Sherlock outputs
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "chameleon-"));

  // Choose sherlock executable (use env if provided)
  const SHERLOCK_BIN =
    process.env.SHERLOCK_BIN ||
    "C:\\Users\\DN138GV\\AppData\\Roaming\\Python\\Python311\\Scripts\\sherlock.exe"; // adjust if needed

  const args = [query, "--csv", "--print-found"];

  // ---- SPAWN: log the exact command and cwd ----
  console.log(`[spawn] ${SHERLOCK_BIN} ${args.join(" ")}  (cwd=${workDir})`);

  const proc = spawn(SHERLOCK_BIN, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
    cwd: workDir,
  });

  proc.stdout.on("data", (c) => push("log", { text: c.toString() }));
  proc.stderr.on("data", (c) => push("log", { text: c.toString() }));

  proc.on("error", (err) => {
    console.log(`[spawn error][job ${jobId}] ${err.message}`);
    push("log", { text: `spawn error: ${err.message}` });
    push("done", {});
  });

  proc.on("close", (code, signal) => {
    console.log(`[spawn close][job ${jobId}] code=${code} signal=${signal}`);
    try {
      const csvPath = findCsvForUser(workDir, query);
      console.log(`[parse][job ${jobId}] csvPath=${csvPath || "(none)"}`);

      if (!csvPath) {
        push("log", { text: "No CSV file produced by Sherlock." });
      } else {
        const raw = fs.readFileSync(csvPath, "utf8");
        const rows = parse(raw, { columns: true, skip_empty_lines: true });

        for (const row of rows) {
          const site =
            row.site || row.name || row.platform || row.SITE || row.Site || "unknown";
          const urlUser =
            row.url_user || row["url user"] || row.URL || row.url || "";
          const status = String(row.status || row.exists || row.result || "").toUpperCase();

          const found =
            status.includes("FOUND") ||
            status.includes("CLAIMED") ||
            status === "TRUE" ||
            (urlUser && urlUser.length > 0);

          if (found) {
            const item = {
              id: `${site}:${urlUser || query}`,
              site,
              title: `${site} match for "${query}"`,
              url: urlUser,
              snippet: query,
              severity: inferSeverity(String(site).toLowerCase()),
              confidence: 0.9,
            };
            push("result", { item });
          }
        }
      }
    } catch (e) {
      push("log", { text: `Error parsing CSV: ${e.message}` });
    } finally {
      try {
        for (const f of fs.readdirSync(workDir)) {
          fs.unlinkSync(path.join(workDir, f));
        }
        fs.rmdirSync(workDir);
      } catch (e) {
        console.log(`[cleanup][job ${jobId}] ${e.message}`);
      }
      push("done", {});
    }
  });

  // ---- SEND: log the immediate response we return to the web app ----
  console.log(`[POST /scan] respond -> { jobId: "${jobId}" }`);
  res.json({ jobId });
});

app.get("/stream/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    console.log(`[SSE connect] job ${jobId} NOT FOUND -> 404`);
    return res.status(404).end();
  }

  console.log(`[SSE connect] job ${jobId} opened from ${req.ip}`);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const flush = setInterval(() => {
    while (job.buffer.length) {
      const line = job.buffer.shift();
      res.write(`data: ${line}\n\n`);
    }
  }, 150);

  req.on("close", () => {
    clearInterval(flush);
    console.log(`[SSE close] job ${jobId} connection closed`);
  });
});

function findCsvForUser(dir, query) {
  const safe = String(query).replace(/[\\/:*?"<>|]/g, "_");
  const exact = path.join(dir, `${safe}.csv`);
  if (fs.existsSync(exact)) return exact;

  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv"));
  if (!files.length) return null;
  files.sort(
    (a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs
  );
  return path.join(dir, files[0]);
}

function inferSeverity(site) {
  return ["twitter", "facebook", "linkedin", "github"].includes(site) ? "high" : "medium";
}

const PORT = 41234;
app.listen(PORT, () => console.log(`[runner] http://localhost:${PORT}`));
