export type QvacEmotion =
  | 'Neutral'
  | 'Happy'
  | 'Sad'
  | 'Anger'
  | 'Narration'
  | 'Conversation'
  | 'Surprise'
  | 'Command'
  | 'Fear'
  | 'Disgust'
  | 'News'
  | 'Proper Noun'

export type QvacPace = 'Slow' | 'Moderate' | 'Fast'

export interface Voice {
  id: string
  name: string
  description: string
  category: 'preset' | 'cloned'
  color: string
  avatarUrl: string
  initials: string
  gender: 'Female' | 'Male' | 'Neutral'
  tags: string[]
  referenceAudioName?: string
  sampleUrl?: string
  languageCode?: string
  languageName?: string
}

export interface ParlerSpeaker {
  id: string
  name: string
  description: string
  color: string
}

export const INITIAL_PARLER_SPEAKERS: ParlerSpeaker[] = [
  {
    id: 'speaker-1',
    name: 'Maya',
    description: 'A Black American woman in a podcast environment.',
    color: '#a855f7', // purple
  },
  {
    id: 'speaker-2',
    name: 'Marcus',
    description: 'A Black American man with a deep voice in a podcast studio.',
    color: '#3b82f6', // blue
  },
  {
    id: 'speaker-3',
    name: 'Kendra',
    description: 'A Black American woman speaking casually in a podcast environment.',
    color: '#ec4899', // pink
  },
]

export interface SpeechRound {
  id: string
  voiceId: string
  text: string
  speed: number // WSOLA multiplier for this round (0.5 to 2.0)
  emotion?: QvacEmotion
  pace?: QvacPace
  prompt?: string
  description?: string
  referenceAudioSrc?: string
  speakerName?: string
  speakerColor?: string
}

export interface Generation {
  id: string
  roundIndex: number
  title: string
  textSnippet: string
  speakerName: string
  speakerColor: string
  speakerAvatarUrl?: string
  duration: number // in seconds
  waveform: number[]
  timestamp: string
  emotion?: QvacEmotion
  rating?: 'up' | 'down'
  audioUrl?: string
}

export interface HistoryEntry {
  id: string
  text: string
  previewSnippet?: string
  voiceName: string
  voiceColor: string
  voiceAvatarUrl?: string
  dateGroup: string
  timeAgo: string
  timestamp?: number
  model: string
  engine?: 'cosyvoice3' | 'chatterbox'
  duration: string
  durationSec?: number
  emotion?: QvacEmotion
  audioUrl?: string
  waveform?: number[]
  roundsData?: SpeechRound[]
  voicePrompt?: string
  language?: string
  speakerCount?: number
  generationId?: string
}

