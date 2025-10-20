import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './ExifTool.css'

interface ExifToolResult {
  filename: string
  metadata: Record<string, any>
  thumbnails: Array<{type: string; data: string}>
  hashes: {MD5: string; SHA256: string}
  fileVerification: {
    extensionMatches: boolean
    warning: string | null
    declaredType: string | null
    actualType: string | null
  }
  gpsData: {
    hasGPS: boolean
    latitude: string | null
    longitude: string | null
    altitude: string | null
    mapUrl: string | null
  }
  timestampAnalysis: {
    timestamps: Record<string, string>
    warnings: string[]
  }
  deviceInfo: Record<string, string>
  fileStats: {
    size: number
    sizeHuman: string
    modified: string
    created: string
  }
  success?: boolean
  error?: string
}

interface HexDump {
  address: string
  hex: string
  ascii: string
}

type Mode = 'single' | 'batch' | 'compare' | 'hex'

export default function ExifTool() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('single')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [result, setResult] = useState<ExifToolResult | null>(null)
  const [batchResults, setBatchResults] = useState<ExifToolResult[]>([])
  const [hexData, setHexData] = useState<{filename: string; fileSize: number; hexDump: HexDump[]} | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'all'>('overview')
  const [isRemovingMetadata, setIsRemovingMetadata] = useState(false)
  const [compareKeys, setCompareKeys] = useState<string[]>([])

  const RUNNER_URL = import.meta.env.VITE_RUNNER_URL || 'http://localhost:41234'

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (mode === 'batch' || mode === 'compare') {
      const files = Array.from(event.target.files || [])
      setSelectedFiles(files)
      handleBatchAnalyze(files)
    } else {
      const file = event.target.files?.[0]
      if (file) {
        setSelectedFile(file)
        if (mode === 'hex') {
          handleHexDump(file)
        } else {
          handleAnalyze(file)
        }
      }
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    
    if (mode === 'batch' || mode === 'compare') {
      const files = Array.from(event.dataTransfer.files)
      setSelectedFiles(files)
      handleBatchAnalyze(files)
    } else {
      const file = event.dataTransfer.files?.[0]
      if (file) {
        setSelectedFile(file)
        if (mode === 'hex') {
          handleHexDump(file)
        } else {
          handleAnalyze(file)
        }
      }
    }
  }

  const handleAnalyze = async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${RUNNER_URL}/exiftool/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to analyze file')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBatchAnalyze = async (files: File[]) => {
    setIsProcessing(true)
    setError(null)
    setBatchResults([])

    const formData = new FormData()
    files.forEach(file => formData.append('files', file))

    try {
      const response = await fetch(`${RUNNER_URL}/exiftool/batch-analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Batch analysis failed: ${response.status}`)
      }

      const data = await response.json()
      setBatchResults(data.results)
      
      // For compare mode, extract all unique keys
      if (mode === 'compare') {
        const allKeys = new Set<string>()
        data.results.forEach((r: ExifToolResult) => {
          Object.keys(r.metadata).forEach(key => allKeys.add(key))
        })
        setCompareKeys(Array.from(allKeys).sort())
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze files')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleHexDump = async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setHexData(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('offset', '0')
    formData.append('length', '2048')  // First 2KB

    try {
      const response = await fetch(`${RUNNER_URL}/exiftool/hex-dump`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Hex dump failed: ${response.status}`)
      }

      const data = await response.json()
      setHexData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to get hex dump')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRemoveMetadata = async () => {
    if (!selectedFile) return

    setIsRemovingMetadata(true)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch(`${RUNNER_URL}/exiftool/remove-metadata`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Failed to remove metadata: ${response.status}`)
      }

      const data = await response.json()
      
      const byteCharacters = atob(data.data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray])
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      alert('Metadata removed successfully! File downloaded.')
    } catch (err: any) {
      alert(`Error: ${err.message || 'Failed to remove metadata'}`)
    } finally {
      setIsRemovingMetadata(false)
    }
  }

  const handleDownload = () => {
    if (!result) return

    const lines = [
      `ExifTool Analysis Report`,
      `File: ${result.filename}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `=`.repeat(80),
      `FILE INFORMATION`,
      `=`.repeat(80),
      `Size: ${result.fileStats.sizeHuman} (${result.fileStats.size} bytes)`,
      `Created: ${result.fileStats.created}`,
      `Modified: ${result.fileStats.modified}`,
      ``,
      `=`.repeat(80),
      `FILE HASHES`,
      `=`.repeat(80),
      `MD5:    ${result.hashes.MD5}`,
      `SHA256: ${result.hashes.SHA256}`,
      ``
    ]

    if (result.fileVerification) {
      lines.push(`=`.repeat(80))
      lines.push(`FILE TYPE VERIFICATION`)
      lines.push(`=`.repeat(80))
      lines.push(`Declared Type: ${result.fileVerification.declaredType || 'Unknown'}`)
      lines.push(`Actual Type: ${result.fileVerification.actualType || 'Unknown'}`)
      lines.push(`Match: ${result.fileVerification.extensionMatches ? 'Yes' : 'NO - WARNING'}`)
      if (result.fileVerification.warning) lines.push(`Warning: ${result.fileVerification.warning}`)
      lines.push(``)
    }

    if (result.deviceInfo && Object.keys(result.deviceInfo).length > 0) {
      lines.push(`=`.repeat(80))
      lines.push(`DEVICE/CAMERA INFORMATION`)
      lines.push(`=`.repeat(80))
      Object.entries(result.deviceInfo).forEach(([key, value]) => {
        lines.push(`${key}: ${value}`)
      })
      lines.push(``)
    }

    if (result.gpsData?.hasGPS) {
      lines.push(`=`.repeat(80))
      lines.push(`GPS LOCATION DATA`)
      lines.push(`=`.repeat(80))
      lines.push(`Latitude: ${result.gpsData.latitude}`)
      lines.push(`Longitude: ${result.gpsData.longitude}`)
      if (result.gpsData.altitude) lines.push(`Altitude: ${result.gpsData.altitude}`)
      if (result.gpsData.mapUrl) lines.push(`Map: ${result.gpsData.mapUrl}`)
      lines.push(``)
    }

    if (result.timestampAnalysis?.timestamps && Object.keys(result.timestampAnalysis.timestamps).length > 0) {
      lines.push(`=`.repeat(80))
      lines.push(`TIMESTAMP ANALYSIS`)
      lines.push(`=`.repeat(80))
      Object.entries(result.timestampAnalysis.timestamps).forEach(([key, value]) => {
        lines.push(`${key}: ${value}`)
      })
      if (result.timestampAnalysis.warnings.length > 0) {
        lines.push(``)
        lines.push(`Warnings:`)
        result.timestampAnalysis.warnings.forEach(warning => {
          lines.push(`  - ${warning}`)
        })
      }
      lines.push(``)
    }

    lines.push(`=`.repeat(80))
    lines.push(`ALL METADATA (${Object.keys(result.metadata).length} fields)`)
    lines.push(`=`.repeat(80))
    Object.entries(result.metadata).forEach(([key, value]) => {
      lines.push(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    })

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    a.download = `${dateStr}-exiftool-${result.filename}.txt`
    
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadBatch = () => {
    if (batchResults.length === 0) return

    const lines = [
      `ExifTool Batch Analysis Report`,
      `Files Analyzed: ${batchResults.length}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `=`.repeat(80)
    ]

    batchResults.forEach((result, idx) => {
      lines.push(``)
      lines.push(`FILE ${idx + 1}: ${result.filename}`)
      lines.push(`=`.repeat(80))
      if (result.error) {
        lines.push(`ERROR: ${result.error}`)
      } else {
        lines.push(`Size: ${result.fileStats?.sizeHuman}`)
        lines.push(`MD5: ${result.hashes?.MD5}`)
        lines.push(`SHA256: ${result.hashes?.SHA256}`)
        if (result.deviceInfo && Object.keys(result.deviceInfo).length > 0) {
          lines.push(`Device: ${result.deviceInfo.make || ''} ${result.deviceInfo.model || ''}`)
        }
        if (result.gpsData?.hasGPS) {
          lines.push(`GPS: ${result.gpsData.latitude}, ${result.gpsData.longitude}`)
        }
      }
    })

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    a.download = `${dateStr}-exiftool-batch.txt`
    
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExit = () => {
    // Get the saved carousel position
    const savedIndex = localStorage.getItem('homeCarouselIndex')
    const selectedIndex = savedIndex ? parseInt(savedIndex, 10) : 0
    // Navigate back with the saved position
    navigate('/home', { state: { selectedIndex } })
  }

  const handleNewAnalysis = () => {
    setSelectedFile(null)
    setSelectedFiles([])
    setResult(null)
    setBatchResults([])
    setHexData(null)
    setError(null)
    setActiveTab('overview')
    setCompareKeys([])
  }

  const hasAnyResults = result || batchResults.length > 0 || hexData

  return (
    <div className="exiftool-tool">
      <div className="exiftool-background">
        <div className="exiftool-pattern"></div>
      </div>

      <button className="exit-button" onClick={handleExit} title="Back to Home">
        ◂
      </button>

      {hasAnyResults && (
        <button className="new-analysis-button-float" onClick={handleNewAnalysis}>
          New Analysis
        </button>
      )}

      {/* Mode Selection */}
      {!hasAnyResults && !isProcessing && (
        <div className="exiftool-upload">
          <div className="upload-container">
            <div className="exiftool-branding">
              <img src="/exiftool.svg" alt="ExifTool" className="exiftool-logo" />
              <h1 className="exiftool-title-text">ExifTool</h1>
            </div>
            <h2>Upload File to Analyze Metadata</h2>
            
            {/* Mode Selector */}
            <div className="mode-selector">
              <button 
                className={`mode-button${mode === 'single' ? ' active' : ''}`}
                onClick={() => setMode('single')}
              >
                📄 Single File
              </button>
              <button 
                className={`mode-button${mode === 'batch' ? ' active' : ''}`}
                onClick={() => setMode('batch')}
              >
                📦 Batch (Multiple)
              </button>
              <button 
                className={`mode-button${mode === 'compare' ? ' active' : ''}`}
                onClick={() => setMode('compare')}
              >
                🔍 Compare Files
              </button>
              <button 
                className={`mode-button${mode === 'hex' ? ' active' : ''}`}
                onClick={() => setMode('hex')}
              >
                🧬 Hex View
              </button>
            </div>

            <div
              className={`upload-zone${isDragging ? ' dragging' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-icon">
                {mode === 'batch' || mode === 'compare' ? '📁📁' : '📁'}
              </div>
              <div className="upload-text">
                <p className="upload-primary">
                  {mode === 'batch' || mode === 'compare' 
                    ? 'Drag & drop multiple files here' 
                    : 'Drag & drop a file here'}
                </p>
                <p className="upload-secondary">or click to browse</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept="*/*"
                multiple={mode === 'batch' || mode === 'compare'}
              />
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <p className="upload-hint">
              {mode === 'single' && 'Comprehensive metadata analysis with GPS, device info, and more'}
              {mode === 'batch' && 'Analyze up to 20 files at once'}
              {mode === 'compare' && 'Compare metadata across multiple files side-by-side'}
              {mode === 'hex' && 'View raw binary data in hexadecimal format'}
            </p>
          </div>
        </div>
      )}

      {/* Processing screen */}
      {isProcessing && (
        <div className="exiftool-processing">
          <div className="processing-container">
            <img src="/exiftool.svg" alt="ExifTool" className="processing-logo" />
            <h2>
              {mode === 'batch' ? 'Analyzing Multiple Files...' : 
               mode === 'compare' ? 'Comparing Files...' :
               mode === 'hex' ? 'Reading Binary Data...' :
               'Analyzing Metadata...'}
            </h2>
            <p className="processing-message">
              {mode === 'batch' || mode === 'compare' 
                ? `Processing ${selectedFiles.length} files`
                : 'Extracting comprehensive information'}
            </p>
            <div className="processing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}

      {/* Single File Results */}
      {result && mode === 'single' && (
        <div className="exiftool-results">
          <div className="results-container">
            <div className="results-header">
              <div className="results-title">
                <h2>Metadata Analysis Results</h2>
                <p className="results-filename">{result.filename} ({result.fileStats.sizeHuman})</p>
              </div>
              <div className="header-actions">
                <button onClick={handleRemoveMetadata} className="remove-metadata-button" disabled={isRemovingMetadata}>
                  {isRemovingMetadata ? 'Removing...' : '🗑️ Remove Metadata'}
                </button>
                <button onClick={handleDownload} className="download-button">
                  💾 Download Report
                </button>
              </div>
            </div>

            {!result.fileVerification.extensionMatches && (
              <div className="warning-banner">
                <span className="warning-icon">⚠️</span>
                <div>
                  <strong>File Type Mismatch</strong>
                  <p>{result.fileVerification.warning}</p>
                </div>
              </div>
            )}

            <div className="tabs">
              <button 
                className={`tab${activeTab === 'overview' ? ' active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`tab${activeTab === 'all' ? ' active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Metadata ({Object.keys(result.metadata).length})
              </button>
            </div>

            {activeTab === 'overview' && (
              <div className="overview-grid">
                {result.thumbnails.length > 0 && (
                  <div className="info-card">
                    <h3>📸 Extracted Images</h3>
                    <div className="thumbnails-container">
                      {result.thumbnails.map((thumb, idx) => (
                        <div key={idx} className="thumbnail">
                          <img src={`data:image/jpeg;base64,${thumb.data}`} alt={thumb.type} />
                          <span className="thumbnail-label">{thumb.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.gpsData.hasGPS && (
                  <div className="info-card">
                    <h3>🗺️ GPS Location</h3>
                    <div className="gps-info">
                      <p><strong>Latitude:</strong> {result.gpsData.latitude}</p>
                      <p><strong>Longitude:</strong> {result.gpsData.longitude}</p>
                      {result.gpsData.altitude && <p><strong>Altitude:</strong> {result.gpsData.altitude}</p>}
                      {result.gpsData.mapUrl && (
                        <a href={result.gpsData.mapUrl} target="_blank" rel="noopener noreferrer" className="map-link">
                          📍 View on Map
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {Object.keys(result.deviceInfo).length > 0 && (
                  <div className="info-card">
                    <h3>📷 Device Information</h3>
                    <div className="device-info">
                      {Object.entries(result.deviceInfo).map(([key, value]) => (
                        <p key={key}><strong>{key}:</strong> {value}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="info-card">
                  <h3>🔐 File Hashes</h3>
                  <div className="hashes-info">
                    <p><strong>MD5:</strong> <code>{result.hashes.MD5}</code></p>
                    <p><strong>SHA256:</strong> <code>{result.hashes.SHA256}</code></p>
                  </div>
                </div>

                {Object.keys(result.timestampAnalysis.timestamps).length > 0 && (
                  <div className="info-card">
                    <h3>🕐 Timestamps</h3>
                    <div className="timestamps-info">
                      {Object.entries(result.timestampAnalysis.timestamps).map(([key, value]) => (
                        <p key={key}><strong>{key}:</strong> {value}</p>
                      ))}
                      {result.timestampAnalysis.warnings.length > 0 && (
                        <div className="timestamp-warnings">
                          {result.timestampAnalysis.warnings.map((warning, idx) => (
                            <p key={idx} className="warning-text">⚠️ {warning}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'all' && (
              <div className="metadata-grid">
                {Object.entries(result.metadata).map(([key, value]) => (
                  <div key={key} className="metadata-item">
                    <div className="metadata-key">{key}</div>
                    <div className="metadata-value">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch Results */}
      {batchResults.length > 0 && mode === 'batch' && (
        <div className="exiftool-results">
          <div className="results-container">
            <div className="results-header">
              <div className="results-title">
                <h2>Batch Analysis Results</h2>
                <p className="results-filename">{batchResults.length} files analyzed</p>
              </div>
              <button onClick={handleDownloadBatch} className="download-button">
                💾 Download Batch Report
              </button>
            </div>

            <div className="batch-grid">
              {batchResults.map((r, idx) => (
                <div key={idx} className="batch-card">
                  <h4>{r.filename}</h4>
                  {r.error ? (
                    <p className="error-text">Error: {r.error}</p>
                  ) : (
                    <>
                      <p><strong>Size:</strong> {r.fileStats.sizeHuman}</p>
                      <p><strong>MD5:</strong> <code className="small-code">{r.hashes.MD5?.slice(0, 16)}...</code></p>
                      {Object.keys(r.deviceInfo).length > 0 && (
                        <p><strong>Device:</strong> {r.deviceInfo.make || ''} {r.deviceInfo.model || ''}</p>
                      )}
                      {r.gpsData.hasGPS && (
                        <p className="gps-badge">📍 GPS: {r.gpsData.latitude}, {r.gpsData.longitude}</p>
                      )}
                      {!r.fileVerification.extensionMatches && (
                        <p className="warning-badge">⚠️ File type mismatch</p>
                      )}
                      <p className="metadata-count">{Object.keys(r.metadata).length} metadata fields</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Compare Results */}
      {batchResults.length > 0 && mode === 'compare' && (
        <div className="exiftool-results">
          <div className="results-container">
            <div className="results-header">
              <div className="results-title">
                <h2>File Comparison</h2>
                <p className="results-filename">{batchResults.length} files compared</p>
              </div>
              <button onClick={handleDownloadBatch} className="download-button">
                💾 Download Comparison
              </button>
            </div>

            <div className="comparison-table-wrapper">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th className="sticky-col">Metadata Field</th>
                    {batchResults.map((r, idx) => (
                      <th key={idx}>{r.filename}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Key metadata first */}
                  <tr>
                    <td className="sticky-col"><strong>File Size</strong></td>
                    {batchResults.map((r, idx) => (
                      <td key={idx}>{r.fileStats?.sizeHuman}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="sticky-col"><strong>MD5 Hash</strong></td>
                    {batchResults.map((r, idx) => (
                      <td key={idx}><code className="small-code">{r.hashes?.MD5?.slice(0, 16)}...</code></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="sticky-col"><strong>Device Make</strong></td>
                    {batchResults.map((r, idx) => (
                      <td key={idx}>{r.deviceInfo?.make || '-'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="sticky-col"><strong>Device Model</strong></td>
                    {batchResults.map((r, idx) => (
                      <td key={idx}>{r.deviceInfo?.model || '-'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="sticky-col"><strong>GPS</strong></td>
                    {batchResults.map((r, idx) => (
                      <td key={idx}>{r.gpsData?.hasGPS ? `${r.gpsData.latitude}, ${r.gpsData.longitude}` : '-'}</td>
                    ))}
                  </tr>
                  {/* Show some common metadata fields */}
                  {compareKeys.slice(0, 50).map(key => {
                    const values = batchResults.map(r => r.metadata[key])
                    const allSame = values.every(v => v === values[0])
                    return (
                      <tr key={key} className={!allSame ? 'different-values' : ''}>
                        <td className="sticky-col">{key}</td>
                        {values.map((val, idx) => (
                          <td key={idx}>{typeof val === 'object' ? JSON.stringify(val) : String(val || '-')}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {compareKeys.length > 50 && (
              <p className="comparison-note">Showing first 50 fields. Download full report for complete comparison.</p>
            )}
          </div>
        </div>
      )}

      {/* Hex View */}
      {hexData && mode === 'hex' && (
        <div className="exiftool-results">
          <div className="results-container">
            <div className="results-header">
              <div className="results-title">
                <h2>Hexadecimal View</h2>
                <p className="results-filename">{hexData.filename} ({hexData.fileSize} bytes)</p>
              </div>
            </div>

            <div className="hex-viewer">
              <div className="hex-header">
                <span className="hex-col">Address</span>
                <span className="hex-col hex-bytes">Hex Bytes</span>
                <span className="hex-col">ASCII</span>
              </div>
              {hexData.hexDump.map((line, idx) => (
                <div key={idx} className="hex-line">
                  <span className="hex-address">{line.address}</span>
                  <span className="hex-bytes">{line.hex}</span>
                  <span className="hex-ascii">{line.ascii}</span>
                </div>
              ))}
            </div>
            <p className="hex-note">Showing first 2KB of file. For full binary analysis, use specialized forensic tools.</p>
          </div>
        </div>
      )}
    </div>
  )
}
