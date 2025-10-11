// src/routes/Results.tsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import App from '../App'   // <- your existing charts page (unchanged)

export default function Results() {
  const location = useLocation()

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

  // Render your existing charts page unchanged
  return <App />
}