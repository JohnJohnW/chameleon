import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data: any) => {
    // Whitelist channels
    const validChannels = ['toMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  receive: (channel: string, func: Function) => {
    const validChannels = ['fromMain', 'main-process-message']
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    }
  },
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = ['dialog:openFile']
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
  },
})

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, data: any) => void
      receive: (channel: string, func: Function) => void
      invoke: (channel: string, ...args: any[]) => Promise<any>
    }
  }
}

