import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Whois.css'

interface WhoisData {
  domain?: string
  registrar?: string
  registrant?: string
  created?: string
  expires?: string
  updated?: string
  nameservers?: string[]
  status?: string[]
  emails?: string[]
  raw?: string
}

export default function Whois() {
  const navigate = useNavigate()
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState<WhoisData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExit = () => {
    const savedIndex = localStorage.getItem('homeCarouselIndex')
    const selectedIndex = savedIndex ? parseInt(savedIndex, 10) : 0
    navigate('/home', { state: { selectedIndex } })
  }

  const cleanDomain = (input: string): string => {
    // Remove http://, https://, www., and trailing slashes
    let clean = input.trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
    
    // Extract just the domain if there's a path
    const pathIndex = clean.indexOf('/')
    if (pathIndex !== -1) {
      clean = clean.substring(0, pathIndex)
    }
    
    return clean
  }

  const lookupWhois = async () => {
    const cleanedDomain = cleanDomain(domain)
    
    if (!cleanedDomain) {
      alert('Please enter a domain name')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || 'http://localhost:41234'
      const response = await fetch(`${RUNNER_URL}/whois/lookup?domain=${encodeURIComponent(cleanedDomain)}`)
      
      if (!response.ok) {
        throw new Error('Failed to lookup domain')
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to lookup domain information')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewLookup = () => {
    setDomain('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="whois-tool">
      <div className="whois-background">
        <div className="whois-pattern"></div>
      </div>

      <button className="exit-button" onClick={handleExit} title="Back to Home">
        ◂
      </button>

      {result && (
        <button className="new-lookup-button-float" onClick={handleNewLookup}>
          New Lookup
        </button>
      )}

      {!result && !isLoading && (
        <div className="whois-search">
          <div className="search-container">
            <div className="whois-branding">
              <h1 className="whois-title-text">WHOIS Lookup</h1>
            </div>
            <h2>Enter Domain to Investigate</h2>
            <div className="search-box">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupWhois()}
                placeholder="e.g. example.com, google.com"
                className="whois-input"
                autoFocus
              />
              <button onClick={lookupWhois} className="lookup-button">
                Lookup
              </button>
            </div>
            <p className="search-hint">
              Find domain ownership, registration dates, and registrar information
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-message">Looking up domain information...</p>
        </div>
      )}

      {error && (
        <div className="whois-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleNewLookup} className="retry-button">
            Try Another Domain
          </button>
        </div>
      )}

      {result && !isLoading && (
        <div className="whois-results">
          <div className="results-header">
            <h2>WHOIS Information</h2>
            <p className="results-domain">{result.domain}</p>
          </div>

          <div className="results-grid">
            {result.registrar && (
              <div className="result-section">
                <h3>Registrar</h3>
                <p>{result.registrar}</p>
              </div>
            )}

            {result.registrant && (
              <div className="result-section">
                <h3>Registrant</h3>
                <p>{result.registrant}</p>
              </div>
            )}

            {result.created && (
              <div className="result-section">
                <h3>Created Date</h3>
                <p>{result.created}</p>
              </div>
            )}

            {result.expires && (
              <div className="result-section">
                <h3>Expires Date</h3>
                <p>{result.expires}</p>
              </div>
            )}

            {result.updated && (
              <div className="result-section">
                <h3>Updated Date</h3>
                <p>{result.updated}</p>
              </div>
            )}

            {result.nameservers && result.nameservers.length > 0 && (
              <div className="result-section full-width">
                <h3>Name Servers</h3>
                <ul className="nameserver-list">
                  {result.nameservers.map((ns, i) => (
                    <li key={i}>{ns}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.status && result.status.length > 0 && (
              <div className="result-section full-width">
                <h3>Status</h3>
                <ul className="status-list">
                  {result.status.map((status, i) => (
                    <li key={i}>{status}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.emails && result.emails.length > 0 && (
              <div className="result-section full-width">
                <h3>Contact Emails</h3>
                <ul className="email-list">
                  {result.emails.map((email, i) => (
                    <li key={i}>{email}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.raw && (
              <div className="result-section full-width">
                <h3>Raw WHOIS Data</h3>
                <pre className="raw-whois">{result.raw}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

