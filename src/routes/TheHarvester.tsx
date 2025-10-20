import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './TheHarvester.css'

interface HarvesterResult {
  id: string
  type: 'email' | 'host' | 'ip'
  value: string
  domain: string
}

export default function TheHarvester() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [results, setResults] = useState<HarvesterResult[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [dnsResolve, setDnsResolve] = useState(false)
  const [dnsBrute, setDnsBrute] = useState(false)
  const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || 'http://localhost:41234'

  const startScan = async (q?: string) => {
    const toScan = (typeof q === 'string' ? q : query).trim()
    if (!toScan) {
      alert('Enter a domain to scan.')
      return
    }
    try {
      const r = await fetch(`${RUNNER_URL}/harvester/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: toScan,
          dnsResolve,
          dnsBrute
        }),
      })
      if (!r.ok) throw new Error(`scan failed: ${r.status}`)
      const { jobId } = await r.json()
      setQuery(toScan)
      setJobId(jobId)
      setHasResults(false)
      setResults([])
      setLogs([])
    } catch (e) {
      console.error(e)
      alert('Could not start scan. Is the server running?')
    }
  }

  const handleExit = () => {
    // If on loading screen or results screen, cancel/reset instead of navigating back
    if (jobId) {
      handleNewScan()
    } else {
      // Navigate immediately for seamless transition
      const savedIndex = localStorage.getItem('homeCarouselIndex')
      const selectedIndex = savedIndex ? parseInt(savedIndex, 10) : 0
      navigate('/home', { state: { selectedIndex } })
    }
  }

  const handleNewScan = () => {
    setJobId(null)
    setQuery('')
    setHasResults(false)
    setResults([])
    setLogs([])
  }

  // Handle SSE stream
  useEffect(() => {
    if (!jobId) return

    const eventSource = new EventSource(`${RUNNER_URL}/stream/${jobId}`)
    
    eventSource.onopen = () => {
      console.log('[SSE] Connection opened')
    }

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        console.log('[SSE] Received:', msg.type, msg)

        if (msg.type === 'log') {
          setLogs(prev => [...prev, msg.text])
        } else if (msg.type === 'result') {
          if (!hasResults) {
            setHasResults(true)
          }
          setResults(prev => [...prev, msg.item])
        } else if (msg.type === 'done') {
          console.log('[SSE] Scan complete')
          // Ensure results screen is shown even if no results
          if (!hasResults) {
            setHasResults(true)
          }
          eventSource.close()
        }
      } catch (err) {
        console.error('[SSE] Parse error:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('[SSE] Connection error:', err)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [jobId, RUNNER_URL])

  const downloadResults = () => {
    if (results.length === 0) {
      alert('No results to download')
      return
    }

    const emailsSection = results.filter(r => r.type === 'email')
    const hostsSection = results.filter(r => r.type === 'host')
    const ipsSection = results.filter(r => r.type === 'ip')

    const content = [
      `theHarvester Results for: ${query}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      '='.repeat(50),
      'EMAILS FOUND:',
      '='.repeat(50),
      ...emailsSection.map((r, i) => `${i + 1}. ${r.value}`),
      '',
      '='.repeat(50),
      'HOSTS/SUBDOMAINS FOUND:',
      '='.repeat(50),
      ...hostsSection.map((r, i) => `${i + 1}. ${r.value}`),
      '',
      '='.repeat(50),
      'IP ADDRESSES FOUND:',
      '='.repeat(50),
      ...ipsSection.map((r, i) => `${i + 1}. ${r.value}`),
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    a.download = `${dateStr}-harvester-${query}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const hosts = results.filter(r => r.type === 'host')
  const ips = results.filter(r => r.type === 'ip')

  return (
    <div className={`harvester-tool${isExiting ? ' exiting' : ''}`}>
      {/* TheHarvester-themed background */}
      <div className="harvester-background">
        <div className="harvester-pattern"></div>
      </div>

      {/* Floating home button */}
      <button className="exit-button" onClick={handleExit} title="Back to Home">
        ◂
      </button>

      {/* Floating new scan button */}
      {jobId && hasResults && (
        <button className="new-scan-button-float" onClick={handleNewScan}>
          New Scan
        </button>
      )}

      {/* Search interface */}
      {!jobId && (
        <div className="harvester-search">
          <div className="search-container">
            <div className="harvester-branding">
              <img src="/theharvester.svg" alt="theHarvester" className="harvester-logo" />
              <h1 className="harvester-title-text">theHarvester</h1>
            </div>
            <h2>Enter Domain to Investigate</h2>
            <div className="search-box">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startScan()}
                placeholder="e.g. example.com, company.com"
                className="harvester-input"
                autoFocus
              />
              <button onClick={() => startScan()} className="scan-button">
                Harvest
              </button>
            </div>
            <p className="search-hint">
              Gather emails, subdomains, hosts, and employee names from public sources
            </p>
            
            <div className="advanced-options">
              <h3>Advanced Options</h3>
              <div className="options-grid">
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={dnsResolve}
                    onChange={(e) => setDnsResolve(e.target.checked)}
                  />
                  <span>DNS Resolution</span>
                  <small>Resolve all subdomains to IP addresses</small>
                </label>
                
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={dnsBrute}
                    onChange={(e) => setDnsBrute(e.target.checked)}
                  />
                  <span>DNS Brute Force</span>
                  <small>Brute force subdomains (slower, more thorough)</small>
                </label>
              </div>
              <p className="options-note">
                ℹ️ Using 6 free sources: crtsh, hackertarget, dnsdumpster, virustotal, otx, rapiddns
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading screen */}
      {jobId && !hasResults && (
        <div className="harvester-loading">
          <div className="loading-container">
            <img src="/theharvester.svg" alt="theHarvester" className="loading-logo" />
            <h2>Harvesting data for "{query}"...</h2>
            <p className="loading-message">
              Searching public sources for information
            </p>
            <p className="loading-hint">
              This may take a few minutes. Results will appear as they're discovered.
            </p>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}

      {/* Results panel */}
      {jobId && hasResults && (
        <div className="harvester-results">
          <div className="results-container">
            <div className="results-header">
              <div className="results-title">
                <h2>Harvest Results: {query}</h2>
                <p className="results-summary">{hosts.length} hosts • {ips.length} IPs</p>
              </div>
              <button onClick={downloadResults} className="download-button">
                Download Results (.txt)
              </button>
            </div>

            <div className="results-grid">
              {/* Hosts/Subdomains */}
              <div className="result-section">
                <h3 className="section-title">🌐 Hosts & Subdomains ({hosts.length})</h3>
                <div className="result-list">
                  {hosts.length === 0 ? (
                    <div className="no-results">No hosts found</div>
                  ) : (
                    <ul>
                      {hosts.map((item) => (
                        <li key={item.id} className="result-item">
                          <span className="result-value">{item.value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* IP Addresses */}
              <div className="result-section">
                <h3 className="section-title">🔢 IP Addresses ({ips.length})</h3>
                <div className="result-list">
                  {ips.length === 0 ? (
                    <div className="no-results">No IPs found</div>
                  ) : (
                    <ul>
                      {ips.map((item) => (
                        <li key={item.id} className="result-item">
                          <span className="result-value">{item.value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

