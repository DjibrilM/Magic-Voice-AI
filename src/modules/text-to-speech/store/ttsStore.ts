import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { TextToSpeechState, SpeechRound, Generation, HistoryEntry, Voice, ParlerSpeaker } from '../types'

export interface PersistedTtsState {
  engine: 'cosyvoice3' | 'chatterbox'
  parlerSpeakers?: ParlerSpeaker[]
  selectedParlerSpeakerId?: string
  language: string
  selectedVoiceId: string
  customVoices: Voice[]
  rounds: SpeechRound[]
  focusedRoundIndex: number
  generations: Generation[]
  activeGeneration: Generation | null
  voicePrompt: string
  stability: number
  similarity: number
  styleExaggeration: number
  cfgScale: number
  speed: number
  lavaSrEnabled: boolean
  volume: number
  isMuted: boolean
  rightPanelTab: 'settings' | 'history'
  history: HistoryEntry[]
}

/**
 * Checks if a string contains legacy mock / demo starter text
 */
export function isLegacyPlaceholderText(text?: string | null): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return (
    lower.includes('trusted you') ||
    lower.includes('every secret') ||
    lower.includes('every fear') ||
    lower.includes('used it against') ||
    lower.includes('against me') ||
    lower.includes('against meme')
  )
}

/**
 * Sanitizes round text, replacing any legacy placeholder text with an empty string
 */
export function cleanRoundText(text?: string | null): string {
  if (!text) return ''
  return isLegacyPlaceholderText(text) ? '' : text
}

/**
 * Cleans an array of speech rounds to guarantee no placeholder text persists
 */
export function cleanRounds(rounds?: SpeechRound[] | null): SpeechRound[] {
  if (!Array.isArray(rounds) || rounds.length === 0) {
    return [
      {
        id: 'round-1',
        voiceId: 'voice-en-male-1',
        text: '',
        speed: 1.0,
        emotion: 'Neutral',
        pace: 'Moderate',
      },
    ]
  }
  return rounds.map((r) => ({
    ...r,
    text: cleanRoundText(r.text),
  }))
}

/**
 * Cleans history entries, dropping any legacy placeholder text and obsolete mock models
 */
export function cleanHistory(history?: HistoryEntry[] | null): HistoryEntry[] {
  if (!Array.isArray(history) || history.length === 0) {
    return []
  }
  return history.filter(
    (item) =>
      !isLegacyPlaceholderText(item.text) &&
      item.model !== 'Chatterbox T3 Turbo' &&
      item.model !== 'Chatterbox Expressive'
  )
}

const defaultPersistedState: PersistedTtsState = {
  engine: 'cosyvoice3',
  language: 'English (US)',
  selectedVoiceId: 'voice-en-male-1',
  customVoices: [],
  rounds: [
    {
      id: 'round-1',
      voiceId: 'voice-en-male-1',
      text: '',
      speed: 1.0,
      emotion: 'Neutral',
      pace: 'Moderate',
    },
  ],
  focusedRoundIndex: 0,
  generations: [],
  activeGeneration: null,
  voicePrompt: '',
  stability: 0.5,
  similarity: 0.75,
  styleExaggeration: 0.0,
  cfgScale: 2.0,
  speed: 1.0,
  lavaSrEnabled: true,
  volume: 0.85,
  isMuted: false,
  rightPanelTab: 'settings',
  history: [],
}

export const TTS_STORAGE_KEY = 'echo_tts_persisted_state_v8'

// Purge any legacy localStorage keys and dirty values on module load
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const legacyKeys = [
      'echo_tts_persisted_state_v1',
      'echo_tts_persisted_state_v2',
      'echo_tts_persisted_state_v3',
      'echo_tts_persisted_state_v4',
      'echo_tts_persisted_state_v5',
      'echo_tts_persisted_state_v6',
      'echo_tts_persisted_state_v7',
      'echo_tts_state',
      'tts_persisted_state',
    ]
    for (const key of legacyKeys) {
      window.localStorage.removeItem(key)
    }

    // Inspect current key if already saved
    const raw = window.localStorage.getItem(TTS_STORAGE_KEY)
    if (raw && isLegacyPlaceholderText(raw)) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.rounds)) {
          parsed.rounds = cleanRounds(parsed.rounds)
          parsed.history = cleanHistory(parsed.history)
          window.localStorage.setItem(TTS_STORAGE_KEY, JSON.stringify(parsed))
        } else {
          window.localStorage.removeItem(TTS_STORAGE_KEY)
        }
      } catch {
        window.localStorage.removeItem(TTS_STORAGE_KEY)
      }
    }
  } catch (err) {
    console.error('[ttsStore] LocalStorage scrub error:', err)
  }
}

// Custom storage driver with automatic round text sanitization and safe history storage
const ttsStorage = {
  getItem: (key: string, initialValue: PersistedTtsState): PersistedTtsState => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return initialValue
      const raw = window.localStorage.getItem(key)
      if (!raw) return initialValue
      const parsed = JSON.parse(raw) as PersistedTtsState
      if (!parsed || !Array.isArray(parsed.rounds)) return initialValue

      const sanitized: PersistedTtsState = {
        ...parsed,
        rounds: cleanRounds(parsed.rounds),
        history: cleanHistory(parsed.history),
      }

      return sanitized
    } catch {
      return initialValue
    }
  },
  setItem: (key: string, newValue: PersistedTtsState): void => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return
      // Strip massive audio data URIs before writing to localStorage to prevent quota overflow
      const safeHistory = (newValue.history || []).map((item) => {
        if (item.audioUrl && item.audioUrl.length > 50000) {
          const { audioUrl: _, ...rest } = item
          return rest
        }
        return item
      })
      const sanitized: PersistedTtsState = {
        ...newValue,
        rounds: cleanRounds(newValue.rounds),
        history: cleanHistory(safeHistory),
      }
      window.localStorage.setItem(key, JSON.stringify(sanitized))
    } catch (e) {
      console.error('[ttsStore] Failed to save state to localStorage:', e)
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key)
      }
    } catch {}
  },
}

// Persistent atom stored in localStorage so state survives page transitions and app restarts
export const ttsPersistedAtom = atomWithStorage<PersistedTtsState>(
  TTS_STORAGE_KEY,
  defaultPersistedState,
  ttsStorage
)

// Ephemeral runtime atom for active session UI state (playing, synthesizing, dialogs, etc.)
export interface EphemeralTtsState {
  searchLangQuery: string
  isLanguageSelectorOpen: boolean
  voices: Voice[]
  shufflingRoundId: string | null
  isSynthesizing: boolean
  synthesisProgress: string
  isPlaying: boolean
  playbackProgress: number
  currentTime: number
  seekTarget: number | null
  prevVolume: number
  isCloneModalOpen: boolean
  cloneVoiceName: string
  cloneVoiceGender: 'Female' | 'Male' | 'Neutral'
  cloneVoiceTags: string[]
  cloneCustomTag: string
  cloneFile: File | null
  cloneMode: 'record' | 'upload'
  isRecording: boolean
  recordedAudioUrl: string | null
  recordedDuration: number
  isPlayingRecording: boolean
  historySearch: string
  playingHistoryId: string | null
}

const defaultEphemeralState: EphemeralTtsState = {
  searchLangQuery: '',
  isLanguageSelectorOpen: false,
  voices: [],
  shufflingRoundId: null,
  isSynthesizing: false,
  synthesisProgress: '',
  isPlaying: false,
  playbackProgress: 0,
  currentTime: 0,
  seekTarget: null,
  prevVolume: 0.85,
  isCloneModalOpen: false,
  cloneVoiceName: '',
  cloneVoiceGender: 'Female',
  cloneVoiceTags: [],
  cloneCustomTag: '',
  cloneFile: null,
  cloneMode: 'upload',
  isRecording: false,
  recordedAudioUrl: null,
  recordedDuration: 0,
  isPlayingRecording: false,
  historySearch: '',
  playingHistoryId: null,
}

export const ttsEphemeralAtom = atom<EphemeralTtsState>(defaultEphemeralState)

// Composite atom that provides the complete TextToSpeechState interface
export const ttsCompositeStateAtom = atom<TextToSpeechState, [Partial<TextToSpeechState>], void>(
  (get) => {
    const persisted = get(ttsPersistedAtom)
    const ephemeral = get(ttsEphemeralAtom)

    return {
      ...persisted,
      rounds: cleanRounds(persisted.rounds),
      history: cleanHistory(persisted.history),
      ...ephemeral,
    }
  },
  (_get, set, updates) => {
    const persistedKeys: (keyof PersistedTtsState)[] = [
      'engine',
      'language',
      'selectedVoiceId',
      'customVoices',
      'rounds',
      'focusedRoundIndex',
      'generations',
      'activeGeneration',
      'voicePrompt',
      'stability',
      'similarity',
      'styleExaggeration',
      'cfgScale',
      'speed',
      'lavaSrEnabled',
      'volume',
      'isMuted',
      'rightPanelTab',
      'history',
    ]

    const persistedUpdates: Partial<PersistedTtsState> = {}
    const ephemeralUpdates: Partial<EphemeralTtsState> = {}

    for (const [key, val] of Object.entries(updates)) {
      if (persistedKeys.includes(key as keyof PersistedTtsState)) {
        ;(persistedUpdates as Record<string, unknown>)[key] = val
      } else {
        ;(ephemeralUpdates as Record<string, unknown>)[key] = val
      }
    }

    if (persistedUpdates.rounds) {
      persistedUpdates.rounds = cleanRounds(persistedUpdates.rounds)
    }

    if (persistedUpdates.history) {
      persistedUpdates.history = cleanHistory(persistedUpdates.history)
    }

    if (Object.keys(persistedUpdates).length > 0) {
      set(ttsPersistedAtom, (prev) => {
        const updated = { ...prev, ...persistedUpdates }
        return {
          ...updated,
          rounds: cleanRounds(updated.rounds),
          history: cleanHistory(updated.history),
        }
      })
    }

    if (Object.keys(ephemeralUpdates).length > 0) {
      set(ttsEphemeralAtom, (prev) => ({ ...prev, ...ephemeralUpdates }))
    }
  }
)
