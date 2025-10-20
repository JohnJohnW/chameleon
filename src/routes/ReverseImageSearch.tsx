import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './ReverseImageSearch.css'

export default function ReverseImageSearch() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<'upload' | 'url'>('upload')

  const handleExit = () => {
    const savedIndex = localStorage.getItem('homeCarouselIndex')
    const selectedIndex = savedIndex ? parseInt(savedIndex, 10) : 0
    navigate('/home', { state: { selectedIndex } })
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const searchWithGoogle = () => {
    if (searchMode === 'url' && imageUrl) {
      window.open(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`, '_blank')
    } else {
      window.open('https://lens.google.com/search', '_blank')
      alert('Please upload your image using Google Lens')
    }
  }

  const searchWithYandex = () => {
    if (searchMode === 'url' && imageUrl) {
      window.open(`https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(imageUrl)}`, '_blank')
    } else {
      window.open('https://yandex.com/images/', '_blank')
      alert('Please use the camera icon in Yandex Images to upload your image')
    }
  }

  const searchWithTinEye = () => {
    if (searchMode === 'url' && imageUrl) {
      window.open(`https://tineye.com/search?url=${encodeURIComponent(imageUrl)}`, '_blank')
    } else {
      window.open('https://tineye.com/', '_blank')
      alert('Please upload your image using TinEye')
    }
  }

  const searchAll = () => {
    if (!imageUrl && !selectedFile) {
      alert('Please provide an image URL or upload an image first')
      return
    }
    searchWithGoogle()
    setTimeout(() => searchWithYandex(), 500)
    setTimeout(() => searchWithTinEye(), 1000)
  }

  return (
    <div className="reverse-image-tool">
      <div className="reverse-image-background" />

      <button className="exit-button" onClick={handleExit} title="Back">
        ◂
      </button>

      <div className="reverse-image-container">
        <div className="reverse-image-header">
          <h1>Reverse Image Search</h1>
          <p>Search for an image across multiple search engines</p>
        </div>

        <div className="search-mode-toggle">
          <button
            className={searchMode === 'upload' ? 'active' : ''}
            onClick={() => setSearchMode('upload')}
          >
            Upload Image
          </button>
          <button
            className={searchMode === 'url' ? 'active' : ''}
            onClick={() => setSearchMode('url')}
          >
            Image URL
          </button>
        </div>

        {searchMode === 'upload' ? (
          <div
            className="upload-area"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div className="image-preview">
                <img src={previewUrl} alt="Preview" />
                <button
                  className="remove-image"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                    setPreviewUrl(null)
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon">+</div>
                <p>Click or drag & drop an image here</p>
                <small>Supports JPG, PNG, GIF, WebP</small>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div className="url-input-area">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="url-input"
            />
            {imageUrl && (
              <div className="url-preview">
                <img src={imageUrl} alt="URL Preview" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }} />
              </div>
            )}
          </div>
        )}

        <div className="search-engines">
          <h3>Search Engines</h3>
          <div className="engine-buttons">
            <button className="engine-btn" onClick={searchWithGoogle}>
              Google Lens
            </button>
            <button className="engine-btn" onClick={searchWithYandex}>
              Yandex
            </button>
            <button className="engine-btn" onClick={searchWithTinEye}>
              TinEye
            </button>
          </div>
          <button className="search-all-btn" onClick={searchAll}>
            Search All
          </button>
        </div>

        <div className="search-tips">
          <h4>Notes</h4>
          <ul>
            <li>Image URL mode provides the fastest and most direct results</li>
            <li>Google Lens offers AI-powered image recognition and context</li>
            <li>Yandex excels at finding social media profiles and face matches</li>
            <li>TinEye specializes in tracking image modifications and original sources</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

