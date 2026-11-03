export type VoiceEngineType = 'cosyvoice3'
export type AnyEngineType = VoiceEngineType

export type ModelCategory =
  | 'backbone'
  | 'vocoder'
  | 'enhancer'
  | 'multilingual'

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

export interface ModelDownloadResult {
  success: boolean
  modelId: string
  error?: string
}
