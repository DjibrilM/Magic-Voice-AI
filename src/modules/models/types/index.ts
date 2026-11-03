export type VoiceEngineType = 'cosyvoice3' | 'chatterbox'
export type MusicEngineType = 'acestep' | 'minimax'
export type StoryEngineType = 'story'
export type AnyEngineType = VoiceEngineType | MusicEngineType | StoryEngineType

export type ModelCategory =
  | 'backbone'
  | 'vocoder'
  | 'enhancer'
  | 'multilingual'
  | 'text-encoder'
  | 'lm'
  | 'dit'
  | 'vae'

export type ModelStatus = 'idle' | 'downloading' | 'ready' | 'error'

export interface VoiceModelInfo {
  id: string
  name: string
  descriptorName: string
  sizeBytes: number
  sizeFormatted: string
  description: string
  category: ModelCategory
  engine?: AnyEngineType | 'shared'
  required: boolean
  downloaded: boolean
  status: ModelStatus
  downloadProgress?: number // 0-100
  downloadedBytes?: number
  downloadSpeed?: string
  error?: string
}

export interface VoiceModelStatusResult {
  ready: boolean
  allRequiredDownloaded: boolean
  models: VoiceModelInfo[]
  cacheDirectory: string
}

export interface ModelDownloadProgressPayload {
  modelId: string
  percentage: number
  downloaded: number
  total: number
  speed?: string
}

export interface ModelDownloadOptions {
  modelId?: string
  allRequired?: boolean
  engine?: AnyEngineType
}

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
