// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.jsx'

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Splash from './Splash'
import Home from './routes/Home'
import ExifTool from './routes/ExifTool'
import TheHarvester from './routes/TheHarvester'
import Whois from './routes/Whois'
import Holehe from './routes/Holehe'
import Maigret from './routes/Maigret'
import ReverseImageSearch from './routes/ReverseImageSearch'
import Geolocation from './routes/Geolocation'
import Ollama from './routes/Ollama'
import './index.css'   // keep your global styles

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/maigret" element={<Maigret />} />
        <Route path="/exiftool" element={<ExifTool />} />
        <Route path="/theharvester" element={<TheHarvester />} />
        <Route path="/whois" element={<Whois />} />
        <Route path="/holehe" element={<Holehe />} />
        <Route path="/reverse-image" element={<ReverseImageSearch />} />
        <Route path="/geolocation" element={<Geolocation />} />
        <Route path="/ollama" element={<Ollama />} />
        <Route path="/splash" element={<Splash />} />
        {/* Legacy route compatibility */}
        <Route path="/scan" element={<Navigate to="/maigret" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
