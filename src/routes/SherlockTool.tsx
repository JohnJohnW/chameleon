// src/routes/SherlockTool.tsx - Sherlock-specific interface
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ChartsPanel from '../components/ChartsPanel'
import './SherlockTool.css'

export default function SherlockTool() {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || 'http://localhost:41234'

  const startScan = async (q?: string) => {
    const toScan = (typeof q === 'string' ? q : query).trim()
    if (!toScan) {
      alert('Enter a username to scan.')
      return
    }
    try {
      const r = await fetch(`${RUNNER_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: toScan }),
      })
      if (!r.ok) throw new Error(`scan failed: ${r.status}`)
      const { jobId } = await r.json()
      setQuery(toScan)
      setJobId(jobId)
      setHasResults(false) // Reset for new scan
    } catch (e) {
      console.error(e)
      alert('Could not start scan. Is the server running?')
    }
  }

  // Auto-scan from URL query parameter
  useEffect(() => {
    try {
      const qp = new URLSearchParams(location.search)
      const q = qp.get('query')
      if (q && !jobId) {
        setQuery(q)
        startScan(q)
      }
    } catch (_) {
      // ignore URL parsing errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExit = () => {
    setIsExiting(true)
    setTimeout(() => {
      navigate(-1)
    }, 500)
  }

  const handleNewScan = () => {
    // Force a complete reset by clearing jobId first, then setting query
    setJobId(null)
    setQuery('')
    setHasResults(false)
    // Use setTimeout to ensure state updates before next scan
    setTimeout(() => {
      console.log('[SherlockTool] Ready for new scan')
    }, 100)
  }

  // Callback for when first result arrives from ChartsPanel
  const onFirstResult = () => {
    setHasResults(true)
  }

  return (
    <div className={`sherlock-tool${isExiting ? ' exiting' : ''}`}>
      {/* Sherlock-themed background */}
      <div className="sherlock-background">
        <div className="sherlock-pattern"></div>
      </div>

      {/* Floating home button */}
      <button className="exit-button" onClick={handleExit} title="Back to Home">
        ←
      </button>

      {/* Floating new scan button - only show when results are visible */}
      {jobId && hasResults && (
        <button className="new-scan-button-float" onClick={handleNewScan}>
          New Scan
        </button>
      )}

      {/* Search interface */}
      {!jobId && (
        <div className="sherlock-search">
          <div className="search-container">
            <div className="sherlock-branding">
              <img src="/sherlock.png" alt="Sherlock" className="sherlock-logo" />
              <h1 className="sherlock-title-text">Sherlock</h1>
            </div>
            <h2>Enter Username to Investigate</h2>
            <div className="search-box">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startScan()}
                placeholder="e.g. torvalds, elonmusk, john_doe"
                className="sherlock-input"
                autoFocus
              />
              <button onClick={() => startScan()} className="scan-button">
                Scan
              </button>
            </div>
            <p className="search-hint">
              Sherlock will search across 400+ social networks and platforms
            </p>
          </div>
        </div>
      )}

      {/* Loading screen - shown while waiting for results */}
      {jobId && !hasResults && (
        <div className="sherlock-loading">
          <div className="loading-container">
            <img src="/sherlock.png" alt="Sherlock" className="loading-logo" />
            <h2>Investigating "{query}"...</h2>
            <p className="loading-message">
              Sherlock is searching across 400+ platforms
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

      {/* Results panel - always mounted when jobId exists, but hidden until hasResults */}
      {jobId && (
        <div className="sherlock-results" style={{ display: hasResults ? 'block' : 'none' }}>
          <ChartsPanel key={jobId} jobId={jobId} useMock={false} onFirstResult={onFirstResult} username={query} />
        </div>
      )}
    </div>
  )
}

