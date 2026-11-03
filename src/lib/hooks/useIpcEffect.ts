import { useEffect, useRef } from 'react'
import {
  ttsProgressListeners,
  ttsCompleteListeners,
  ttsErrorListeners,
  modelsDownloadProgressListeners,
  terminalLogListeners,
} from '@/components/providers/IpcProvider'
import type {
  TtsProgressEvent,
  TtsCompleteEvent,
  TtsErrorEvent,
  TerminalLogMessage,
} from '@/lib/interfaces/ipc-gateway.interface'
import type { ModelDownloadProgressPayload } from '@/lib/interfaces/models.interface'

export interface UseIpcEffectOptions {
  onTtsProgress?: (data: TtsProgressEvent) => void
  onTtsComplete?: (data: TtsCompleteEvent) => void
  onTtsError?: (data: TtsErrorEvent) => void
  onModelsDownloadProgress?: (data: ModelDownloadProgressPayload) => void
  onTerminalLog?: (data: TerminalLogMessage) => void
}

/**
 * React hook to register real-time IPC listeners for TTS and Shatter-Box models.
 */
export const useIpcEffect = ({
  onTtsProgress,
  onTtsComplete,
  onTtsError,
  onModelsDownloadProgress,
  onTerminalLog,
}: UseIpcEffectOptions) => {
  const listenerId = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `listener-${Date.now()}-${Math.random()}`
  )

  useEffect(() => {
    const id = listenerId.current

    if (onTtsProgress) {
      ttsProgressListeners.set(id, onTtsProgress)
    }

    if (onTtsComplete) {
      ttsCompleteListeners.set(id, onTtsComplete)
    }

    if (onTtsError) {
      ttsErrorListeners.set(id, onTtsError)
    }

    if (onModelsDownloadProgress) {
      modelsDownloadProgressListeners.set(id, onModelsDownloadProgress)
    }

    if (onTerminalLog) {
      terminalLogListeners.set(id, onTerminalLog)
    }

    return () => {
      ttsProgressListeners.delete(id)
      ttsCompleteListeners.delete(id)
      ttsErrorListeners.delete(id)
      modelsDownloadProgressListeners.delete(id)
      terminalLogListeners.delete(id)
    }
  }, [
    onTtsProgress,
    onTtsComplete,
    onTtsError,
    onModelsDownloadProgress,
    onTerminalLog,
  ])
}

export default useIpcEffect
