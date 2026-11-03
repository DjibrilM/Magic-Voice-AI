export interface SystemMetrics {
  ram: {
    usedGB: string
    totalGB: string
    percent: number
  }
  cpu: {
    percent: number
    cores: number
    model: string
  }
  gpu: {
    percent: number
    name: string
  }
}

export interface OpenExportsResult {
  success: boolean
  path?: string
  error?: string
}

export interface ModelStorageItem {
  id: string
  name: string
  sizeBytes: number
  sizeFormatted: string
  downloaded: boolean
  category?: string
  engine?: string
}

export type InferenceDeviceType = 'gpu' | 'cpu'

export interface StorageInfoResult {
  success: boolean
  modelsStorageBytes: number
  modelsStorageFormatted: string
  mediaStorageBytes: number
  mediaStorageFormatted: string
  totalStorageBytes: number
  totalStorageFormatted: string
  mediaDestinationFolder: string
  mediaFilesCount?: number
  inferenceDevice?: InferenceDeviceType
  models: ModelStorageItem[]
  error?: string
}

export interface InferenceDeviceResult {
  success: boolean
  device: InferenceDeviceType
  error?: string
}

export interface MicrophonePermissionResult {
  success: boolean
  granted: boolean
  status: 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'
  error?: string
}

export interface MediaFolderResult {
  success: boolean
  path?: string
  cancelled?: boolean
  error?: string
}
