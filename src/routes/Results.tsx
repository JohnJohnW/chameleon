// src/routes/Results.tsx
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import App from '../App'
import './Results.css'

export default function Results() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('query')
    if (!q) return

    // Poll for the input and button because App renders them after mount.
    const tick = setInterval(() => {
      const input = document.querySelector('input[placeholder="username (e.g. torvalds)"]') as HTMLInputElement | null
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => (b.textContent || '').trim() === 'Scan now') as HTMLButtonElement | undefined

      if (input && btn) {
        // Set the value and dispatch a React 'input' event so state updates
        input.value = q
        input.dispatchEvent(new Event('input', { bubbles: true }))
        // Click the existing button to trigger your startScan
        btn.click()
        clearInterval(tick)
      }
    }, 100)

    return () => clearInterval(tick)
  }, [location.search])

  const query = new URLSearchParams(location.search).get('query') || ''

  const handleBackClick = () => {
    setIsLeaving(true)
    setTimeout(() => {
      navigate('/')
    }, 300)
  }

  return (
    <div className={`results-page${isLeaving ? ' leaving' : ''}`}>
      <div className="results-overlay" />
      <div className="results-content">
        <div className="results-header">
          <button className="back-button" onClick={handleBackClick}>
            ← Back to search
          </button>
          <h1 style={{ 
            color: 'rgba(255,255,255,0.9)', 
            fontSize: 'clamp(1rem, 2.2vw, 1.5rem)',
            fontWeight: 600,
            fontFamily: "'Avenir Next', 'Segoe UI', system-ui, -apple-system, sans-serif",
            margin: 0
          }}>
            Scanning: {query}
          </h1>
        </div>
        <App />
      </div>
    </div>
  )
}