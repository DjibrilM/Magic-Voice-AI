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
