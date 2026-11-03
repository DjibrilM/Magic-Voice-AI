import React, { useEffect } from 'react'
import type {
  TerminalLogMessage,
  TtsProgressEvent,
  TtsCompleteEvent,
  TtsErrorEvent,
} from '@/lib/interfaces/ipc-gateway.interface'
import type { ModelDownloadProgressPayload } from '@/lib/interfaces/models.interface'

// ============================================================================
// Real-time Event Listener Registries for Magic-Voice AI
// ============================================================================

export const ttsProgressListeners = new Map<string, (data: TtsProgressEvent) => void>()
export const ttsCompleteListeners = new Map<string, (data: TtsCompleteEvent) => void>()
export const ttsErrorListeners = new Map<string, (data: TtsErrorEvent) => void>()
export const modelsDownloadProgressListeners = new Map<string, (data: ModelDownloadProgressPayload) => void>()
export const terminalLogListeners = new Map<string, (data: TerminalLogMessage) => void>()

// Stubs for backwards compatibility with any shared components
export const musicProgressListeners = new Map<string, (data: any) => void>()
export const musicCompleteListeners = new Map<string, (data: any) => void>()
export const musicErrorListeners = new Map<string, (data: any) => void>()
export const musicLyricTokenListeners = new Map<string, (data: { taskId: string; token: string }) => void>()
export const storyProgressListeners = new Map<string, (data: any) => void>()
export const storyCompleteListeners = new Map<string, (data: any) => void>()
export const storyErrorListeners = new Map<string, (data: any) => void>()

// ============================================================================
// Outbound IPC Dispatcher Functions (Renderer -> Main Process)
// ============================================================================

export async function sendTtsGenerate(options: any) {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    return window.ipcRenderer.invoke('tts:generate', options)
  }
  return { success: false, error: 'IPC Renderer unavailable' }
}

export async function sendCancelTts(taskId: string) {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    return window.ipcRenderer.invoke('tts:cancel', { taskId })
  }
  return { success: false, error: 'IPC Renderer unavailable' }
}

export async function sendGetModelsStatus() {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    return window.ipcRenderer.invoke('models:get-status')
  }
  return { success: false, error: 'IPC Renderer unavailable' }
}

export async function sendDownloadModel(payload: { modelId?: string; allRequired?: boolean }) {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    return window.ipcRenderer.invoke('models:download', payload)
  }
  return { success: false, error: 'IPC Renderer unavailable' }
}

export async function sendCancelModelDownload(modelId: string) {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    return window.ipcRenderer.invoke('models:cancel-download', { modelId })
  }
  return { success: false, error: 'IPC Renderer unavailable' }
}

export async function sendGetModelInfo(name: string) {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    return window.ipcRenderer.invoke('models:get-info', { name })
  }
  return { success: false, error: 'IPC Renderer unavailable' }
}

export async function sendDeleteAllModels() {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    return window.ipcRenderer.invoke('models:delete-all')
  }
  return { success: false, error: 'IPC Renderer unavailable' }
}

// ============================================================================
// Real-time IPC Gateway Provider Component
// ============================================================================

export interface IpcProviderProps {
  children: React.ReactNode
}

export const IpcProvider: React.FC<IpcProviderProps> = ({ children }) => {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ipcRenderer) {
      return
    }

    const ipc = window.ipcRenderer

    const onTtsProgress = (_event: any, data: TtsProgressEvent) => {
      ttsProgressListeners.forEach((listener) => listener(data))
    }

    const onTtsComplete = (_event: any, data: TtsCompleteEvent) => {
      ttsCompleteListeners.forEach((listener) => listener(data))
    }

    const onTtsError = (_event: any, data: TtsErrorEvent) => {
      ttsErrorListeners.forEach((listener) => listener(data))
    }

    const onModelsDownloadProgress = (_event: any, data: ModelDownloadProgressPayload) => {
      modelsDownloadProgressListeners.forEach((listener) => listener(data))
    }

    const onTerminalLog = (_event: any, data: TerminalLogMessage) => {
      terminalLogListeners.forEach((listener) => listener(data))
    }

    ipc.on('tts:progress', onTtsProgress)
    ipc.on('tts:complete', onTtsComplete)
    ipc.on('tts:error', onTtsError)
    ipc.on('models:download-progress', onModelsDownloadProgress)
    ipc.on('terminal:log', onTerminalLog)

    return () => {
      ipc.off('tts:progress', onTtsProgress)
      ipc.off('tts:complete', onTtsComplete)
      ipc.off('tts:error', onTtsError)
      ipc.off('models:download-progress', onModelsDownloadProgress)
      ipc.off('terminal:log', onTerminalLog)
    }
  }, [])

  return <>{children}</>
}

export default IpcProvider
