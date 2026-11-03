export interface ActivityTtsOrigin {
  id: string
  text: string
  previewSnippet?: string
  voiceName: string
  voiceColor: string
  voiceAvatarUrl?: string
  model: string
  engine: string
  duration: string
  durationSec?: number
  emotion?: string
  audioUrl?: string
  waveform?: number[]
  speakerCount?: number
  rounds: Array<{
    id: string
    roundOrder?: number
    voiceId?: string
    text: string
    speed?: number
    emotion?: string
    pace?: string
    prompt?: string
    description?: string
    referenceAudioSrc?: string
    speakerName?: string
    speakerColor?: string
  }>
}

export interface ActivityMusicOrigin {
  id: string
  taskId?: string
  title: string
  caption?: string
  lyrics?: string
  audioUrl?: string
  wavFilePath?: string
  duration?: string
  durationMs?: number
  waveform?: number[]
  bpm?: number
  keyscale?: string
  timesignature?: string
  vocalLanguage?: string
  seed?: number
  taskType?: string
  lrc?: string
  qualityScore?: number
  engine?: string
  cover?: string
  createdAt?: string
}

export interface ActivityStoryOrigin {
  id: string
  title: string
  subtitle?: string
  narrator?: string
  duration?: string
  audioUrl?: string
  cover?: string
  text?: string
  chapters?: Array<{
    id: string
    title: string
    duration?: string
    audioUrl?: string
    text?: string
  }>
  model?: string
  engine?: string
  characterVoices?: Array<{ id: string; name: string; avatarUrl?: string }>
  backgroundMusicUrl?: string
  createdAt?: string
}

export interface Activity {
  id: string
  type: 'tts' | 'music' | 'story' | 'stories' | string
  title: string
  description?: string
  category?: string
  subCategory?: string
  originId?: string
  originType?: string
  conversationId?: string
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string

  // Related origin data returned when fetching activities
  data?: ActivityTtsOrigin | ActivityMusicOrigin | ActivityStoryOrigin | Record<string, unknown>
  origin?: ActivityTtsOrigin | ActivityMusicOrigin | ActivityStoryOrigin | Record<string, unknown>
  tts?: ActivityTtsOrigin
  music?: ActivityMusicOrigin
  story?: ActivityStoryOrigin
}
