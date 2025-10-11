/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    send: (channel: string, data: any) => void
    receive: (channel: string, func: Function) => void
    invoke: (channel: string, ...args: any[]) => Promise<any>
  }
}

