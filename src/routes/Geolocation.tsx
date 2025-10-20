import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Geolocation.css'

interface GeoResult {
  ip?: string
  city?: string
  region?: string
  country?: string
  loc?: string  // latitude,longitude
  org?: string  // ISP/Organization
  postal?: string
  timezone?: string
}

export default function Geolocation() {
  const navigate = useNavigate()
  const [searchMode, setSearchMode] = useState<'ip' | 'coords'>('ip')
  const [ipAddress, setIpAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [result, setResult] = useState<GeoResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExit = () => {
    const savedIndex = localStorage.getItem('homeCarouselIndex')
    const selectedIndex = savedIndex ? parseInt(savedIndex, 10) : 0
    navigate('/home', { state: { selectedIndex } })
  }

  const lookupMyIP = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)
    
    try {
      const response = await fetch('https://ipapi.co/json/')
      if (!response.ok) throw new Error('Failed to fetch your IP information')
      const data = await response.json()
      setResult(data)
      setIpAddress(data.ip)
    } catch (err) {
      setError('Failed to lookup your IP address. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const lookupIP = async () => {
    if (!ipAddress.trim()) {
      alert('Please enter an IP address')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)
    
    try {
      const response = await fetch(`https://ipapi.co/${ipAddress}/json/`)
      if (!response.ok) throw new Error('Failed to fetch IP information')
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.reason || 'Invalid IP address')
      }
      
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to lookup IP address. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const lookupCoords = async () => {
    if (!latitude.trim() || !longitude.trim()) {
      alert('Please enter both latitude and longitude')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)
    
    try {
      // Use reverse geocoding API
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      )
      if (!response.ok) throw new Error('Failed to fetch location information')
      const data = await response.json()
      
      if (data.error) {
        throw new Error('Invalid coordinates')
      }
      
      setResult({
        loc: `${latitude},${longitude}`,
        city: data.address?.city || data.address?.town || data.address?.village,
        region: data.address?.state,
        country: data.address?.country,
        postal: data.address?.postcode
      })
    } catch (err: any) {
      setError(err.message || 'Failed to lookup coordinates. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const openInMaps = () => {
    if (result?.loc) {
      const [lat, lon] = result.loc.split(',')
      window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank')
    }
  }

  return (
    <div className="geolocation-tool">
      <div className="geolocation-background" />

      <button className="exit-button" onClick={handleExit} title="Back">
        ◂
      </button>

      <div className="geolocation-container">
        <div className="geolocation-header">
          <h1>Geolocation</h1>
          <p>Find location information from IP addresses or coordinates</p>
        </div>

        <div className="search-mode-toggle">
          <button
            className={searchMode === 'ip' ? 'active' : ''}
            onClick={() => setSearchMode('ip')}
          >
            IP Address
          </button>
          <button
            className={searchMode === 'coords' ? 'active' : ''}
            onClick={() => setSearchMode('coords')}
          >
            Coordinates
          </button>
        </div>

        {searchMode === 'ip' ? (
          <div className="search-section">
            <div className="quick-action">
              <button className="quick-btn" onClick={lookupMyIP}>
                Lookup My IP
              </button>
            </div>
            
            <div className="divider">
              <span>or</span>
            </div>

            <div className="input-group">
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupIP()}
                placeholder="e.g. 8.8.8.8"
                className="search-input"
              />
              <button onClick={lookupIP} className="search-btn">
                Lookup
              </button>
            </div>
          </div>
        ) : (
          <div className="search-section">
            <div className="coords-inputs">
              <input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Latitude (e.g. 40.7128)"
                className="search-input"
              />
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupCoords()}
                placeholder="Longitude (e.g. -74.0060)"
                className="search-input"
              />
            </div>
            <button onClick={lookupCoords} className="search-btn-full">
              Lookup
            </button>
          </div>
        )}

        {isLoading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Looking up location information...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
          </div>
        )}

        {result && !isLoading && (
          <div className="results-panel">
            <h3>Location Information</h3>
            
            <div className="result-grid">
              {result.ip && (
                <div className="result-item">
                  <span className="result-label">IP Address</span>
                  <span className="result-value">{result.ip}</span>
                </div>
              )}
              
              {result.loc && (
                <div className="result-item">
                  <span className="result-label">Coordinates</span>
                  <span className="result-value">{result.loc}</span>
                </div>
              )}
              
              {result.city && (
                <div className="result-item">
                  <span className="result-label">City</span>
                  <span className="result-value">{result.city}</span>
                </div>
              )}
              
              {result.region && (
                <div className="result-item">
                  <span className="result-label">Region/State</span>
                  <span className="result-value">{result.region}</span>
                </div>
              )}
              
              {result.country && (
                <div className="result-item">
                  <span className="result-label">Country</span>
                  <span className="result-value">{result.country}</span>
                </div>
              )}
              
              {result.postal && (
                <div className="result-item">
                  <span className="result-label">Postal Code</span>
                  <span className="result-value">{result.postal}</span>
                </div>
              )}
              
              {result.timezone && (
                <div className="result-item">
                  <span className="result-label">Timezone</span>
                  <span className="result-value">{result.timezone}</span>
                </div>
              )}
              
              {result.org && (
                <div className="result-item full-width">
                  <span className="result-label">ISP/Organization</span>
                  <span className="result-value">{result.org}</span>
                </div>
              )}
            </div>

            {result.loc && (
              <button className="map-btn" onClick={openInMaps}>
                View on Google Maps
              </button>
            )}
          </div>
        )}

        <div className="info-tips">
          <h4>Notes</h4>
          <ul>
            <li>IP geolocation is typically accurate to city-level</li>
            <li>VPN and proxy users will show their server location</li>
            <li>Coordinate lookups use OpenStreetMap reverse geocoding</li>
            <li>Uses IPinfo and Nominatim APIs for location data</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

