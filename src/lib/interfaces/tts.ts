import { Voice, SpeechRound, Generation, HistoryEntry, ParlerSpeaker } from './voice'

export interface TextToSpeechState {
  // Voice engine
  engine?: 'cosyvoice3' | 'chatterbox'
  parlerSpeakers?: ParlerSpeaker[]
  selectedParlerSpeakerId?: string

  // Voice & Language selection
  language: string
  searchLangQuery: string
  isLanguageSelectorOpen: boolean
  selectedVoiceId: string
  voices: Voice[]
  customVoices?: Voice[]

  // Multi-speaker dialogue rounds
  rounds: SpeechRound[]
  focusedRoundIndex: number
  shufflingRoundId: string | null

  // Generation & Active Playback
  generations: Generation[]
  activeGeneration: Generation | null
  isSynthesizing: boolean
  synthesisProgress: string
  isPlaying: boolean
  playbackProgress: number
  currentTime: number
  seekTarget: number | null
  isMuted: boolean
  volume: number
  prevVolume: number

  // Bring Your Own Voice modal
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

  // Model parameters (Side drawer)
  voicePrompt: string
  stability: number
  similarity: number
  styleExaggeration: number
  cfgScale: number
  speed: number
  lavaSrEnabled: boolean

  // History & Drawer state
  history: HistoryEntry[]
  historySearch: string
  playingHistoryId: string | null
  rightPanelTab: 'settings' | 'history'
}
