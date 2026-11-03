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

export interface StorageInfoResult {
  success: boolean
  modelsStorageBytes: number
  modelsStorageFormatted: string
  mediaStorageBytes: number
  mediaStorageFormatted: string
  totalStorageBytes: number
  totalStorageFormatted: string
  mediaDestinationFolder: string
  models: ModelStorageItem[]
  error?: string
}

export interface MediaFolderResult {
  success: boolean
  path?: string
  cancelled?: boolean
  error?: string
}
