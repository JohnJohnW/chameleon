# Chameleon Desktop Application Guide

## Overview

Chameleon is now a **standalone desktop application** built with:
- **Frontend**: React + Vite (your beautiful UI/UX stays 100% the same!)
- **Backend**: Python + Flask (perfect for OSINT tools)
- **Desktop**: Electron (packages as .app for Mac, .exe for Windows)

## Architecture

```
┌─────────────────────────┐
│   Electron Window       │
│  (Your React UI/UX)     │
└───────────┬─────────────┘
            │
            │ HTTP Requests
            │
┌───────────┴─────────────┐
│   Python Backend        │
│   (Flask Server)        │
│   - Sherlock            │
│   - Future OSINT Tools  │
└─────────────────────────┘
```

## Setup

### 1. Install Python Dependencies

```bash
cd /Users/john/Downloads/Chameleon-front-end-main/john_commit2
python3 -m pip install -r backend/requirements.txt
```

This installs:
- Flask (web server)
- flask-cors (CORS support)
- sherlock-project (username scanner)

### 2. Install Node.js Dependencies

```bash
npm install
```

This adds:
- electron (desktop framework)
- electron-builder (packaging tool)
- concurrently (run multiple processes)
- wait-on (wait for server to start)

## Running in Development

### Option 1: Run Electron App (Recommended)

This starts both the Vite dev server and Electron window:

```bash
npm run electron:dev
```

The app will:
1. Start React dev server on http://localhost:5173
2. Start Python backend on http://localhost:41234
3. Open Electron window with your app
4. Hot reload on code changes!

### Option 2: Run Separately (For debugging)

Terminal 1 - Start Python backend:
```bash
python3 backend/server.py
```

Terminal 2 - Start React dev server:
```bash
npm run dev
```

Terminal 3 - Start Electron:
```bash
npm run electron
```

## Building for Distribution

### Build for Mac (.dmg and .zip)

```bash
npm run electron:build:mac
```

Output: `dist-electron/Chameleon OSINT-1.0.0.dmg`

### Build for Windows (.exe)

```bash
npm run electron:build:win
```

Output: `dist-electron/Chameleon OSINT Setup 1.0.0.exe`

### Build for Linux (.AppImage)

```bash
npm run electron:build:linux
```

Output: `dist-electron/Chameleon OSINT-1.0.0.AppImage`

### Build for All Platforms

```bash
npm run electron:build
```

## File Structure

```
chameleon/
├── backend/               # Python backend
│   ├── server.py         # Flask server
│   └── requirements.txt  # Python dependencies
├── electron/             # Electron main process
│   ├── main.js          # Electron entry point
│   └── preload.js       # Preload script
├── src/                 # React frontend (unchanged!)
│   ├── routes/
│   │   ├── Home.tsx     # Console-style home
│   │   └── SherlockTool.tsx # Sherlock interface
│   └── components/
├── dist/                # Built React app
└── dist-electron/       # Packaged desktop apps
```

## How It Works

1. **User double-clicks** Chameleon.app (Mac) or Chameleon.exe (Windows)
2. **Electron starts** and launches Python backend in background
3. **Backend starts** Flask server on localhost:41234
4. **Electron window opens** and displays your React UI
5. **React communicates** with Python backend via HTTP
6. **User closes app** → Electron shuts down Python backend automatically

## UI/UX Preservation

✅ **100% of your UI/UX is preserved:**
- All React components stay the same
- All CSS/animations stay the same
- All routing stays the same
- Console-style home screen works perfectly
- Sherlock interface with dark theme works perfectly

The only change is **under the hood**: Node.js server replaced with Python.

## Adding More OSINT Tools

Simply update `backend/server.py` to add new endpoints:

```python
@app.route("/maltego/scan", methods=["POST"])
def maltego_scan():
    # Add Maltego integration
    pass
```

Then create a new React component in `src/routes/` with its own branding!

## Distribution

### For Mac Users:
1. Build: `npm run electron:build:mac`
2. Share: Upload the `.dmg` file
3. Install: Users drag to Applications folder
4. Run: Double-click Chameleon.app

### For Windows Users:
1. Build: `npm run electron:build:win` (requires Windows or cross-compile)
2. Share: Upload the `.exe` installer
3. Install: Users run the installer
4. Run: Double-click Chameleon shortcut

### For Linux Users:
1. Build: `npm run electron:build:linux`
2. Share: Upload the `.AppImage` file
3. Install: Make executable: `chmod +x Chameleon*.AppImage`
4. Run: Double-click or `./Chameleon*.AppImage`

## Troubleshooting

### Python Backend Won't Start

Check Python path in `electron/main.js`:
```javascript
function getPythonCommand() {
  // Update this if needed
  return 'python3'; // or 'python' on Windows
}
```

### Sherlock Not Found

Install Sherlock:
```bash
pip3 install sherlock-project
```

Or set the path in backend/server.py:
```python
sherlock_bin = "/full/path/to/sherlock"
```

### Port Already in Use

Change ports in:
- `electron/main.js` - `BACKEND_PORT = 41234`
- `vite.config.js` - `port: 5173`

## Next Steps

1. ✅ Install dependencies
2. ✅ Run in development: `npm run electron:dev`
3. ✅ Test all features work
4. ✅ Build for distribution: `npm run electron:build:mac`
5. ✅ Share the .dmg file with users!

Your beautiful console-style OSINT tool is now a real desktop application! 🎮🔍




