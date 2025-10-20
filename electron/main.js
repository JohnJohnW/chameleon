// electron/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let pythonProcess;
const BACKEND_PORT = 41234;

// Get Python path based on platform
function getPythonCommand() {
  const platform = process.platform;
  
  if (app.isPackaged) {
    // In production, use bundled Python
    if (platform === 'darwin') {
      return path.join(process.resourcesPath, 'backend', 'venv', 'bin', 'python3');
    } else if (platform === 'win32') {
      return path.join(process.resourcesPath, 'backend', 'venv', 'Scripts', 'python.exe');
    }
  }
  
  // In development, use system Python
  return platform === 'win32' ? 'python' : 'python3';
}

// Get backend script path
function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'server.py');
  }
  return path.join(__dirname, '..', 'backend', 'server.py');
}

// Start Python backend
function startPythonBackend() {
  const pythonCmd = getPythonCommand();
  const backendScript = getBackendPath();
  
  console.log('[Electron] Starting Python backend...');
  console.log('[Electron] Python:', pythonCmd);
  console.log('[Electron] Script:', backendScript);
  
  pythonProcess = spawn(pythonCmd, [backendScript], {
    env: { ...process.env, PORT: BACKEND_PORT.toString() }
  });
  
  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python Backend] ${data.toString().trim()}`);
  });
  
  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python Backend Error] ${data.toString().trim()}`);
  });
  
  pythonProcess.on('close', (code) => {
    console.log(`[Python Backend] Process exited with code ${code}`);
  });
  
  pythonProcess.on('error', (err) => {
    console.error(`[Python Backend] Failed to start: ${err.message}`);
  });
}

// Stop Python backend
function stopPythonBackend() {
  if (pythonProcess) {
    console.log('[Electron] Stopping Python backend...');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// Wait for backend to be ready
async function waitForBackend() {
  const maxAttempts = 30;
  const delay = 500;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const http = require('http');
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${BACKEND_PORT}/`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Status ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      console.log('[Electron] Backend is ready!');
      return true;
    } catch (err) {
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('[Electron] Backend failed to start');
  return false;
}

// Create main window
async function createWindow() {
  // Start Python backend
  startPythonBackend();
  
  // Wait for backend to be ready
  const backendReady = await waitForBackend();
  
  if (!backendReady) {
    console.error('[Electron] Cannot start app without backend');
    app.quit();
    return;
  }
  
  // Create browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0e27',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });
  
  // Load the app
  if (app.isPackaged) {
    // In production, load built files
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }
  
  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopPythonBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  stopPythonBackend();
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
});


