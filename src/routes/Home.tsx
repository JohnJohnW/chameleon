// src/routes/Home.tsx - Nintendo Switch / PS5 style tool selector
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Home.css'

interface Tool {
  id: string
  name: string
  description: string
  icon: string
  route: string
  color: string
}

const tools: Tool[] = [
  {
    id: 'maigret',
    name: 'Maigret',
    description: 'Collect a dossier on a person by username only',
    icon: '/maigret.png',
    route: '/maigret',
    color: '#3b82f6'
  },
  {
    id: 'exiftool',
    name: 'ExifTool',
    description: 'Extract metadata from images and files',
    icon: '/exiftool.svg',
    route: '/exiftool',
    color: '#f59e0b'
  },
  {
    id: 'theharvester',
    name: 'TheHarvester',
    description: 'Discover emails, subdomains, and hosts from public sources',
    icon: '/theharvester.svg',
    route: '/theharvester',
    color: '#06b6d4'
  },
  {
    id: 'whois',
    name: 'WHOIS',
    description: 'Find domain ownership, registration dates, and registrar info',
    icon: '/whois.png',
    route: '/whois',
    color: '#f97316'
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local AI model for analyzing text and images in investigations',
    icon: '/ollama.png',
    route: '/ollama',
    color: '#a855f7'
  },
  {
    id: 'holehe',
    name: 'Holehe',
    description: 'Check if an email is attached to an account on +120 websites',
    icon: '/holehe.svg',
    route: '/holehe',
    color: '#8b5cf6'
  },
  {
    id: 'reverse-image',
    name: 'Reverse Image Search',
    description: 'Search for images across Google, Bing, Yandex, and TinEye',
    icon: '/chameleon.png',
    route: '/reverse-image',
    color: '#10b981'
  },
  {
    id: 'geolocation',
    name: 'Geolocation',
    description: 'Find location information from IP addresses or coordinates',
    icon: '/chameleon.png',
    route: '/geolocation',
    color: '#f43f5e'
  }
]

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  // Restore position from location state, or default to 0
  const [selectedIndex, setSelectedIndex] = useState((location.state as any)?.selectedIndex || 0)
  const [shakeLeft, setShakeLeft] = useState(false)
  const [shakeRight, setShakeRight] = useState(false)

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('homeCarouselIndex', selectedIndex.toString())
  }, [selectedIndex])

  const handlePrevious = () => {
    if (selectedIndex > 0) {
      setSelectedIndex((prev) => prev - 1)
    } else {
      // Trigger shake animation when at the start
      setShakeLeft(true)
      setTimeout(() => setShakeLeft(false), 500)
    }
  }

  const handleNext = () => {
    if (selectedIndex < tools.length - 1) {
      setSelectedIndex((prev) => prev + 1)
    } else {
      // Trigger shake animation when at the end
      setShakeRight(true)
      setTimeout(() => setShakeRight(false), 500)
    }
  }

  const handleSelect = () => {
    // Navigate immediately without exit animation for seamless transition
    navigate(tools[selectedIndex].route, { state: { selectedIndex } })
  }

  const getCardPosition = (index: number) => {
    const diff = index - selectedIndex
    return diff
  }

  const isAtStart = selectedIndex === 0
  const isAtEnd = selectedIndex === tools.length - 1

  return (
    <div className="home-console">
      {/* Animated background */}
      <div className="home-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      {/* Header */}
      <div className="console-header">
        <img src="/chameleon.png" alt="Chameleon" className="console-logo" />
        <h1 className="console-title">Chameleon</h1>
        <p className="console-subtitle">Select a tool to begin investigation</p>
      </div>

      {/* Nintendo Switch / PS5 Style Carousel */}
      <div className="console-carousel">
        {/* Left Arrow */}
        <button 
          className={`console-arrow console-arrow-left ${isAtStart ? 'disabled' : ''} ${shakeLeft ? 'shake' : ''}`}
          onClick={handlePrevious}
          aria-label="Previous tool"
        >
          ◂
        </button>

        {/* Cards Container */}
        <div className="console-cards-container">
          <div className="console-cards-track">
            {tools.map((tool, index) => {
              const position = getCardPosition(index)
              const isCenter = position === 0
              const isVisible = Math.abs(position) <= 2 // Show 5 cards: -2, -1, 0, 1, 2
              
              return (
                <div
                  key={tool.id}
                  className={`console-card ${isCenter ? 'center' : ''} ${
                    !isVisible ? 'hidden' : ''
                  }`}
                  style={{
                    transform: `translateX(${position * 110}%) scale(${isCenter ? 1 : 0.85})`,
                    zIndex: isCenter ? 10 : 8 - Math.abs(position),
                    opacity: !isVisible ? 0 : isCenter ? 1 : 0.6,
                    '--tool-color': tool.color
                  } as React.CSSProperties}
                  onClick={() => {
                    if (isCenter) {
                      handleSelect()
                    } else {
                      setSelectedIndex(index)
                    }
                  }}
                >
                  <div className="console-card-inner">
                    <img 
                      src={tool.icon} 
                      alt={tool.name} 
                      className="console-card-icon"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Arrow */}
        <button 
          className={`console-arrow console-arrow-right ${isAtEnd ? 'disabled' : ''} ${shakeRight ? 'shake' : ''}`}
          onClick={handleNext}
          aria-label="Next tool"
        >
          ▸
        </button>
      </div>

      {/* Tool Info Panel */}
      <div className="console-info-panel">
        <h3 className="info-panel-title">{tools[selectedIndex].name}</h3>
        <p className="info-panel-description">{tools[selectedIndex].description}</p>
      </div>

      {/* Indicator Dots */}
      <div className="console-indicators">
        {tools.map((tool, index) => (
          <button
            key={tool.id}
            className={`indicator-dot ${selectedIndex === index ? 'active' : ''}`}
            onClick={() => setSelectedIndex(index)}
            aria-label={`Go to ${tool.name}`}
          />
        ))}
      </div>
    </div>
  )
}
