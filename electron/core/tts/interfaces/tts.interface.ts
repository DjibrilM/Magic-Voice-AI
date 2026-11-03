export interface TtsSpeechRound {
  id: string
  voiceId: string
  text: string
  speed?: number
  emotion?: string
  pace?: string
  prompt?: string
  description?: string
  referenceAudioSrc?: string
  speakerName?: string
  speakerColor?: string
  prePauseMs?: number
  postPauseMs?: number
}

export interface TtsGenerateOptions {
  taskId: string
  rounds: TtsSpeechRound[]
  speakerName?: string
  speakerColor?: string
  speakerAvatarUrl?: string
  referenceAudioSrc?: string
  language?: string
  prompt?: string
  description?: string
  voicePrompt?: string
  stability?: number
  similarity?: number
  cfgScale?: number
  lavaSrEnabled?: boolean
  speed?: number
  historyIndex?: number
  engine?: 'cosyvoice3' | 'chatterbox'
}

export interface TtsGenerationOutput {
  id: string
  roundIndex: number
  title: string
  textSnippet: string
  speakerName: string
  speakerColor: string
  speakerAvatarUrl: string
  duration: number
  audioUrl: string
  waveform: number[]
  timestamp: string
  emotion?: string
}

export type TtsProgressCallback = (data: {
  taskId: string
  progress: number
  message: string
  phase: string
}) => void

export type TtsLogCallback = (log: {
  text: string
  stream: 'stdout' | 'stderr' | 'system'
}) => void

export interface TtsGenerateResult {
  success: boolean
  data?: TtsGenerationOutput
  error?: string
}

export interface TtsCancelResult {
  success: boolean
  taskId: string
}

