// electron/preload.js
// This file runs before the renderer process loads
// Use it to expose safe APIs to the renderer if needed

const { contextBridge } = require('electron');

// Expose any APIs you need in the renderer
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  // Add more APIs as needed
});


