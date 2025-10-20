import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Maigret.css'

interface MaigretResult {
  id: string
  type: 'site'
  value: string
  url?: string
}

export default function Maigret() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [results, setResults] = useState<MaigretResult[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || 'http://localhost:41234'

  const startScan = async (q?: string) => {
    const toScan = (typeof q === 'string' ? q : query).trim()
    if (!toScan) {
      alert('Enter a username to investigate.')
      return
    }
    try {
      const r = await fetch(`${RUNNER_URL}/maigret/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: toScan }),
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
      `Maigret Username Search Results`,
      `Username: ${query}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `Found on ${results.length} sites:`,
      `${'='.repeat(50)}`,
      ...results.map(r => r.url ? `${r.value}: ${r.url}` : r.value),
    ]

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    a.download = `${dateStr}-maigret-results-${query}.txt`
    
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const sites = results.filter(r => r.type === 'site')

  return (
    <div className={`maigret-tool${isExiting ? ' exiting' : ''}`}>
      <div className="maigret-background" />
      
      <button className="exit-button" onClick={handleExit} title="Back">
        ◂
      </button>

      {jobId && hasResults && (
        <button className="new-scan-button-float" onClick={handleNewScan}>
          New Scan
        </button>
      )}

      {/* Input screen */}
      {!jobId && (
        <div className="maigret-search">
          <div className="maigret-branding">
            <img src="/maigret.png" alt="Maigret" className="maigret-logo" />
            <h1 className="maigret-title-text">Maigret</h1>
          </div>
          <h2>Enter Username to Investigate</h2>
          <div className="search-box">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startScan()}
              placeholder="e.g. johndoe, username123"
              autoFocus
            />
            <button onClick={() => startScan()} className="scan-button">
              Search
            </button>
          </div>
          <p className="search-hint">
            Search for a username across 2000+ websites and social networks
          </p>
        </div>
      )}

      {/* Loading screen */}
      {jobId && !hasResults && (
        <div className="maigret-loading">
          <div className="loading-container">
            <img src="/maigret.png" alt="Maigret" className="loading-logo" />
            <h2>Searching for Username...</h2>
            <p className="loading-message">
              Checking 2000+ websites. This may take several minutes.
              Results will appear as they're found.
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
        <div className="maigret-results">
          <div className="results-container">
            <div className="results-header">
              <div className="results-title">
                <h2>Username Search Results</h2>
                <p className="results-username">{query}</p>
              </div>
              <button onClick={downloadResults} className="download-button">
                Download Results (.txt)
              </button>
            </div>

            <div className="results-grid">
              <div className="result-section">
                <h3 className="section-title">Found Profiles ({sites.length})</h3>
                <div className="result-list">
                  {sites.length === 0 ? (
                    <div className="no-results">
                      Username not found on any of the 2000+ sites checked.
                      <br />
                      <small style={{ opacity: 0.7, marginTop: '0.5rem', display: 'block' }}>
                        This username might not be widely used, or the sites don't publicly show user profiles.
                      </small>
                    </div>
                  ) : (
                    <ul>
                      {sites.sort((a, b) => a.value.localeCompare(b.value)).map((item) => (
                        <li key={item.id} className="result-item">
                          <span className="result-value">
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer">
                                {item.value}
                              </a>
                            ) : (
                              item.value
                            )}
                          </span>
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
