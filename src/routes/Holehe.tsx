import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Holehe.css'

interface HoleheResult {
  id: string
  type: 'site'
  value: string
  email: string
}

export default function Holehe() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [results, setResults] = useState<HoleheResult[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || 'http://localhost:41234'

  const startScan = async (q?: string) => {
    const toScan = (typeof q === 'string' ? q : query).trim()
    if (!toScan) {
      alert('Enter an email address to scan.')
      return
    }
    try {
      const r = await fetch(`${RUNNER_URL}/holehe/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: toScan }),
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

    const lines = [
      `Holehe Email Enumeration Results`,
      `Email: ${query}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `Found on ${results.length} sites:`,
      `${'='.repeat(50)}`,
      ...results.map(r => r.value),
    ]

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    a.download = `${dateStr}-holehe-results-${query.replace('@', '-at-')}.txt`
    
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const sites = results.filter(r => r.type === 'site')

  return (
    <div className={`holehe-tool${isExiting ? ' exiting' : ''}`}>
      {/* Holehe-themed background */}
      <div className="holehe-background">
        <div className="holehe-pattern"></div>
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

      {/* Input screen */}
      {!jobId && (
        <div className="holehe-search">
          <div className="search-container">
            <div className="holehe-branding">
              <img src="/holehe.svg" alt="Holehe" className="holehe-logo" />
              <h1 className="holehe-title-text">Holehe</h1>
            </div>
            <h2>Enter Email to Investigate</h2>
            <div className="search-box">
              <input
                type="email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startScan()}
                placeholder="e.g. example@gmail.com, user@company.com"
                className="holehe-input"
                autoFocus
              />
              <button onClick={() => startScan()} className="scan-button">
                Check Email
              </button>
            </div>
            <p className="search-hint">
              Check if an email is registered on 120+ popular websites and services. 
              Holehe only shows sites where the email is actually found.
            </p>
          </div>
        </div>
      )}

      {/* Loading screen */}
      {jobId && !hasResults && (
        <div className="holehe-loading">
          <div className="loading-container">
            <img src="/holehe.svg" alt="Holehe" className="loading-logo" />
            <h2>Checking Email Registration...</h2>
            <p className="loading-message">
              Checking 120+ websites to see where this email is registered.
              This may take 10-30 seconds. Results will appear as they're found.
            </p>
            <div className="processing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}

      {/* Results panel */}
      {jobId && hasResults && (
        <div className="holehe-results">
          <div className="results-container">
            <div className="results-header">
              <div className="results-title">
                <h2>Email Registration Results</h2>
                <p className="results-email">{query}</p>
              </div>
              <button onClick={downloadResults} className="download-button">
                Download Results (.txt)
              </button>
            </div>

            <div className="results-summary">
              <div className="summary-item">
                <span className="summary-count">{sites.length}</span>
                <span className="summary-label">Sites Found</span>
              </div>
            </div>

            <div className="results-grid">
              {/* Sites where email is registered */}
              <div className="result-section">
                <h3 className="section-title">📧 Registered On ({sites.length} {sites.length !== 1 ? 'sites' : 'site'})</h3>
                <div className="result-list">
                  {sites.length === 0 ? (
                    <div className="no-results">
                      ℹ️ Email not found on any of the 120+ sites checked.
                      <br />
                      <small style={{ opacity: 0.7, marginTop: '0.5rem', display: 'block' }}>
                        This means the email is either not registered on these sites, or the sites don't publicly disclose registration status.
                      </small>
                    </div>
                  ) : (
                    <ul>
                      {sites.sort((a, b) => a.value.localeCompare(b.value)).map((item) => (
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

