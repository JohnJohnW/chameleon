import './App.css'
import { useEffect, useRef, useState } from 'react'

function App() {
  const placeholders = [
    'john smith',
    'jsmitty123',
    'jsmith@outlook.com',
    '+61 412 345 678',
    'smith.co',
    'john.s',
    '42 rainforest road, st kilda 3182',
  ]

  const [isActive, setIsActive] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const intervalRef = useRef<number | null>(null)
  const sentence = placeholders.map((p) => `'${p}'`).join(', ') + ','
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [leavingHome, setLeavingHome] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [reenter, setReenter] = useState(false)
  const loadingLines = [
    'Calibrating chameleon eyes…',
    'Rustling the rainforest…',
    'Following digital footprints…',
    'Asking friendly iguanas for tips…',
    'Finding your information…',
  ]
  const [loadingIndex, setLoadingIndex] = useState(0)

  function handleSubmit() {
    if (isSubmitting) return
    const text = inputValue.trim()
    if (!text) return
    setLeavingHome(true)
    window.setTimeout(() => {
      setIsSubmitting(true)
      setLeavingHome(false)
    }, 260)
    inputRef.current?.blur()
    // TODO: wire to real scan action
  }

  function handleCancel() {
    if (!isSubmitting) return
    setIsCancelling(true)
    // Wait for leave animation, then return to splash
    window.setTimeout(() => {
      setIsSubmitting(false)
      setIsCancelling(false)
      setReenter(true)
      window.setTimeout(() => setReenter(false), 360)
      setTimeout(() => inputRef.current?.focus(), 0)
    }, 320)
  }

  useEffect(() => {
    if (!isSubmitting) return
    const id = window.setInterval(() => {
      setLoadingIndex((i) => (i + 1) % loadingLines.length)
    }, 3000)
    return () => window.clearInterval(id)
  }, [isSubmitting, loadingLines.length])

  useEffect(() => {
    if (isActive) {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = window.setInterval(() => {
        setPlaceholderIndex((i) => (i + 1) % placeholders.length)
      }, 1400)
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [isActive, placeholders.length])

  return (
    <div className="splash">
      <div className="splash-overlay" />
      {isSubmitting ? (
        <div className={`loading-only${isCancelling ? ' leaving' : ''}`} aria-live="polite">
          <div className="loading-spinner" />
          <div className="loading-text" key={loadingIndex}>{loadingLines[loadingIndex]}</div>
          <div className="loading-actions">
            <button type="button" className="cancel-cta" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className={`splash-content${reenter ? ' reenter' : ''}${leavingHome ? ' leaving' : ''}`}>
          <img className="splash-logo" src="/chameleon.png" alt="Logo" />
          <h1 className="splash-title">find yourself before others do</h1>
          <div className="input-wrap">
            <div
              className={`splash-cta${isActive ? ' active' : ''}`}
              role="textbox"
              aria-label="input area"
              onClick={() => inputRef.current?.focus()}
            >
              {inputValue === '' && (
                <span className="scan-placeholder" aria-hidden>
                  scan now
                </span>
              )}
              <input
                ref={inputRef}
                type="text"
                className="splash-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setIsActive(true)}
                onBlur={() => setIsActive(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder=""
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <button
              type="button"
              className={`submit-cta${isActive ? ' show' : ''}`}
              aria-label="submit"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSubmit}
            >
              ➔
            </button>
          </div>
          <a href="#" className="help-link" onClick={(e) => e.preventDefault()}>
            need help?
          </a>
        </div>
      )}
    </div>
  )
}

export default App

