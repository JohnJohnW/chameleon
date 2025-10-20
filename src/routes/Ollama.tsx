import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Ollama.css'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  image?: string
  timestamp: Date
}

export default function Ollama() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'system',
      content: 'Ollama Analysis Engine ready. Paste findings from other tools to identify patterns, connections, and additional investigation avenues.',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || 'http://localhost:41234'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleExit = () => {
    const savedIndex = localStorage.getItem('homeCarouselIndex')
    const selectedIndex = savedIndex ? parseInt(savedIndex, 10) : 0
    navigate('/home', { state: { selectedIndex } })
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const sendMessage = async () => {
    if (!input.trim() && !selectedImage) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      image: imagePreview || undefined,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('message', input)
      if (selectedImage) {
        formData.append('image', selectedImage)
      }

      const response = await fetch(`${RUNNER_URL}/ai/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I apologize, but I couldn\'t generate a response.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      console.error(err)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Error: Could not connect to AI model. Please ensure Ollama is installed and running.\n\nInstall: https://ollama.com\nThen run: ollama pull llama3.2-vision',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      removeImage()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: '0',
        role: 'system',
        content: 'Ollama Analysis Engine ready. Paste findings from other tools to identify patterns, connections, and additional investigation avenues.',
        timestamp: new Date()
      }
    ])
  }


  return (
    <div className="ai-assistant-tool">
      <div className="ai-assistant-background" />

      <button className="exit-button" onClick={handleExit} title="Back">
        ◂
      </button>

      <div className="ai-assistant-container">
        <div className="ai-header">
          <div className="ai-header-content">
            <h1>Ollama</h1>
            <p>Analysis Engine • Correlate Findings & Identify Connections</p>
          </div>
          <div className="ai-status">
            <div className="status-indicator"></div>
            <span>Ready</span>
          </div>
        </div>

        <div className="messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.role}`}
            >
              {message.image && (
                <div className="message-image">
                  <img src={message.image} alt="Uploaded" />
                </div>
              )}
              <div className="message-content">
                <pre>{message.content}</pre>
              </div>
              <div className="message-timestamp">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="typing-text">Analyzing...</div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {imagePreview && (
          <div className="image-preview-bar">
            <img src={imagePreview} alt="Preview" />
            <button onClick={removeImage} className="remove-preview-btn">✕</button>
          </div>
        )}

        <div className="input-container">
          <button
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
          >
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Paste findings from Maigret, Holehe, TheHarvester, or other sources to analyze..."
            className="message-input"
            rows={3}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !selectedImage)}
            className="send-btn"
          >
            {isLoading ? '...' : '▸'}
          </button>
        </div>

        <div className="ai-info">
          <p>
            Analysis runs locally for complete privacy. Requires{' '}
            <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">
              Ollama
            </a>
            {' '}with llama3.2 model installed.
          </p>
        </div>
      </div>
    </div>
  )
}

