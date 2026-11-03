/// <reference types="vite/client" />

import 'react'

declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    inert?: boolean | string | undefined
  }
}

interface Window {
  ipcRenderer?: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    send: (channel: string, ...args: unknown[]) => void
    on: (channel: string, listener: (...args: unknown[]) => void) => void
    off: (channel: string, ...args: unknown[]) => void
  }
}

