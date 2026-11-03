import { SpeechRound, QvacEmotion, QvacPace, Generation } from '../types'
import type {
  TtsProgressEvent,
  TtsCompleteEvent,
  TtsErrorEvent,
  TerminalLogMessage,
} from '@/lib/interfaces/ipc-gateway.interface'
import {
  ttsProgressListeners,
  ttsCompleteListeners,
  ttsErrorListeners,
  terminalLogListeners,
} from '@/components/providers/IpcProvider'

export interface TtsGenerateRequestOptions {
  taskId: string
  rounds: SpeechRound[]
  speakerName?: string
  speakerColor?: string
  speakerAvatarUrl?: string
  referenceAudioSrc?: string
  language?: string
  prompt?: string
  voicePrompt?: string
  description?: string
  stability?: number
  similarity?: number
  cfgScale?: number
  lavaSrEnabled?: boolean
  speed?: number
  historyIndex?: number
  engine?: 'cosyvoice3' | 'chatterbox'
}

import {
  getModelStatus,
  getModelInfo,
  deleteAllModels,
  downloadModel,
  cancelModelDownload,
  onModelDownloadProgress,
  type IpcResponse,
} from '@/modules/models'

export {
  getModelStatus,
  getModelInfo,
  deleteAllModels,
  downloadModel,
  cancelModelDownload,
  onModelDownloadProgress,
  type IpcResponse,
}

/**
 * Invokes the Echo Voice Engine synthesis endpoint via IPC ('tts:generate')
 */
export async function generateSpeech(options: TtsGenerateRequestOptions): Promise<IpcResponse<Generation>> {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    try {
      const res = (await window.ipcRenderer.invoke('tts:generate', options)) as IpcResponse<Generation>
      return res
    } catch (err) {
      console.error('[ttsService] generateSpeech IPC invoke failed:', err)
      return { success: false, error: String(err) }
    }
  }
  return { success: false, error: 'IPC renderer is unavailable in current runtime' }
}

/**
 * Cancels an ongoing voice generation task via IPC ('tts:cancel')
 */
export async function cancelSpeechGeneration(taskId: string): Promise<IpcResponse<{ success: boolean; taskId: string }>> {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    try {
      const res = (await window.ipcRenderer.invoke('tts:cancel', { taskId })) as IpcResponse<{ success: boolean; taskId: string }>
      return res
    } catch (err) {
      console.error('[ttsService] cancelSpeechGeneration IPC invoke failed:', err)
      return { success: false, error: String(err) }
    }
  }
  return { success: false, error: 'IPC renderer is unavailable in current runtime' }
}
/**
 * Subscribes to real-time TTS progress events
 */
export function onProgress(callback: (event: TtsProgressEvent) => void): () => void {
  const subId = `tts-progress-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  ttsProgressListeners.set(subId, callback)
  return () => {
    ttsProgressListeners.delete(subId)
  }
}

/**
 * Subscribes to real-time TTS completion events
 */
export function onComplete(callback: (event: TtsCompleteEvent) => void): () => void {
  const subId = `tts-complete-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  ttsCompleteListeners.set(subId, callback)
  return () => {
    ttsCompleteListeners.delete(subId)
  }
}

/**
 * Subscribes to real-time TTS error events
 */
export function onError(callback: (event: TtsErrorEvent) => void): () => void {
  const subId = `tts-error-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  ttsErrorListeners.set(subId, callback)
  return () => {
    ttsErrorListeners.delete(subId)
  }
}

/**
 * Subscribes to backend terminal logs
 */
export function onTerminalLog(callback: (log: TerminalLogMessage) => void): () => void {
  const subId = `tts-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  terminalLogListeners.set(subId, callback)
  return () => {
    terminalLogListeners.delete(subId)
  }
}


/**
 * Format time in seconds to mm:ss format
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

/**
 * Heuristically auto-tag emotions and pace on speech rounds based on punctuation and sentiment
 */
export function autoTagSpeechRounds(rounds: SpeechRound[]): SpeechRound[] {
  return rounds.map((round) => {
    const lower = round.text.toLowerCase()
    let detectedEmotion: QvacEmotion = 'Neutral'
    let detectedPace: QvacPace = 'Moderate'

    if (
      lower.includes('!') ||
      lower.includes('wow') ||
      lower.includes('amazing') ||
      lower.includes('happy') ||
      lower.includes('love') ||
      lower.includes('glad')
    ) {
      detectedEmotion = 'Happy'
    } else if (
      lower.includes('sorry') ||
      lower.includes('hurt') ||
      lower.includes('sad') ||
      lower.includes('crying') ||
      lower.includes('grief') ||
      lower.includes('fear')
    ) {
      detectedEmotion = 'Sad'
      detectedPace = 'Slow'
    } else if (
      lower.includes('stop') ||
      lower.includes('hate') ||
      lower.includes('never') ||
      lower.includes('furious') ||
      lower.includes('anger') ||
      lower.includes('rage')
    ) {
      detectedEmotion = 'Anger'
      detectedPace = 'Fast'
    } else if (
      lower.includes('listen') ||
      lower.includes('order') ||
      lower.includes('command') ||
      lower.includes('must') ||
      lower.includes('halt') ||
      lower.includes('stand')
    ) {
      detectedEmotion = 'Command'
    } else if (
      lower.includes('once upon') ||
      lower.includes('realm') ||
      lower.includes('chapter') ||
      lower.includes('chronicle') ||
      lower.includes('story')
    ) {
      detectedEmotion = 'Narration'
      detectedPace = 'Slow'
    } else if (
      lower.includes('what') ||
      lower.includes('how') ||
      lower.includes('why') ||
      lower.includes('really?')
    ) {
      detectedEmotion = 'Conversation'
    }

    return {
      ...round,
      emotion: detectedEmotion,
      pace: detectedPace,
    }
  })
}

/**
 * Calculate total character count across dialogue turns
 */
export function calculateTotalCharacters(rounds: SpeechRound[]): number {
  return rounds.reduce((sum, r) => sum + (r.text?.length || 0), 0)
}

/**
 * Estimate speech duration in seconds from speech rounds
 */
export function estimateDuration(rounds: SpeechRound[], globalSpeed = 1.0): number {
  const active = rounds.filter((r) => r.text && r.text.trim().length > 0)
  if (active.length === 0) return 0

  const totalWords = active.reduce((acc, r) => acc + r.text.trim().split(/\s+/).length, 0)
  const baseDuration = Math.max(2.0, totalWords / 2.7 / (globalSpeed || 1.0))
  return Math.round(baseDuration * 10) / 10
}

/**
 * Unified TTS Service Client Singleton
 */
export const ttsService = {
  generateSpeech,
  cancelGeneration: cancelSpeechGeneration,
  cancelSpeechGeneration,
  getModelStatus,
  getModelInfo,
  deleteAllModels,
  downloadModel,
  cancelModelDownload,
  onProgress,
  onComplete,
  onError,
  onTerminalLog,
  onModelDownloadProgress,
  formatTime,
  autoTagSpeechRounds,
  calculateTotalCharacters,
  estimateDuration,
}
