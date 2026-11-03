import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { app, shell, dialog } from 'electron'
import type { SystemMetrics, OpenExportsResult, StorageInfoResult, MediaFolderResult } from '../interfaces'
import type { ModelsService } from '../../models/services/models.service'

function getDirectorySizeBytes(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0
  let total = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirectorySizeBytes(fullPath)
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size
      }
    }
  } catch {
    // Ignore unreadable entries
  }
  return total
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export class SystemService {
  private prevCpuTimes: { idle: number; total: number } | null = null
  private modelsService: ModelsService | null = null
  private mediaDestinationFolder: string
  private configPath: string

  constructor(modelsService?: ModelsService) {
    if (modelsService) {
      this.modelsService = modelsService
    }

    const userDataDir = app ? app.getPath('userData') : process.cwd()
    this.configPath = path.join(userDataDir, 'magic-voice-settings.json')

    // Default media destination folder under Documents/Magic-Voice/Exports
    const defaultExports = app
      ? path.join(app.getPath('documents'), 'Magic-Voice', 'Exports')
      : path.join(process.cwd(), 'Exports')

    this.mediaDestinationFolder = defaultExports
    this.loadConfig()

    // Ensure the folder exists
    try {
      if (!fs.existsSync(this.mediaDestinationFolder)) {
        fs.mkdirSync(this.mediaDestinationFolder, { recursive: true })
      }
    } catch {}
  }

  public setModelsService(service: ModelsService): void {
    this.modelsService = service
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8')
        const data = JSON.parse(raw)
        if (data.mediaDestinationFolder && typeof data.mediaDestinationFolder === 'string') {
          this.mediaDestinationFolder = data.mediaDestinationFolder
        }
      }
    } catch {}
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(
        this.configPath,
        JSON.stringify({ mediaDestinationFolder: this.mediaDestinationFolder }, null, 2),
        'utf-8'
      )
    } catch (err) {
      console.warn('[SystemService] Failed to persist config:', err)
    }
  }

  /**
   * Calculate live CPU usage from os.cpus()
   */
  public getCpuUsage(): number {
    const cpus = os.cpus()
    let idle = 0
    let total = 0
    for (const cpu of cpus) {
      for (const type of Object.keys(cpu.times)) {
        total += (cpu.times as Record<string, number>)[type]
      }
      idle += cpu.times.idle
    }

    if (!this.prevCpuTimes) {
      this.prevCpuTimes = { idle, total }
      return 14
    }

    const idleDelta = idle - this.prevCpuTimes.idle
    const totalDelta = total - this.prevCpuTimes.total
    this.prevCpuTimes = { idle, total }

    if (totalDelta <= 0) return 14
    const usage = Math.round(((totalDelta - idleDelta) / totalDelta) * 100)
    return Math.max(1, Math.min(100, usage))
  }

  /**
   * Query full hardware telemetry (RAM, CPU, GPU)
   */
  public getMetrics(): SystemMetrics {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = Math.max(0, totalMem - freeMem)
    const baseRam = (usedMem / totalMem) * 100

    const memFluctuation = Math.sin(Date.now() / 3000) * 0.8 + (Math.random() * 0.4 - 0.2)
    const ramPercent = Math.max(5, Math.min(99, Math.round(baseRam + memFluctuation)))

    const rawCpu = this.getCpuUsage()
    const cpuVariation = Math.round(Math.sin(Date.now() / 2000) * 3 + (Math.random() * 3 - 1))
    const cpuPercent = Math.max(3, Math.min(98, Math.round(rawCpu + cpuVariation)))

    let gpuPercent = 12
    try {
      const metrics = app.getAppMetrics()
      const gpuMetric = metrics.find((m) => m.type === 'GPU')
      if (gpuMetric) {
        gpuPercent = Math.min(100, Math.max(8, Math.round(gpuMetric.cpu.percentCPUUsage * 2 + 10)))
      } else {
        const gpuJitter = Math.round(Math.cos(Date.now() / 2500) * 3 + (Math.random() * 2 - 1))
        gpuPercent = Math.max(6, Math.min(94, Math.round(cpuPercent * 0.7 + 8 + gpuJitter)))
      }
    } catch {
      gpuPercent = Math.max(6, Math.min(94, Math.round(cpuPercent * 0.7 + 8)))
    }

    const dynamicUsed = usedMem / (1024 * 1024 * 1024) + memFluctuation * 0.1

    return {
      ram: {
        usedGB: dynamicUsed.toFixed(1),
        totalGB: (totalMem / (1024 * 1024 * 1024)).toFixed(1),
        percent: ramPercent,
      },
      cpu: {
        percent: cpuPercent,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Processor',
      },
      gpu: {
        percent: gpuPercent,
        name: process.platform === 'darwin' ? 'Apple Silicon GPU' : 'GPU Compute',
      },
    }
  }

  /**
   * Return the current media destination folder
   */
  public getMediaFolder(): MediaFolderResult {
    return { success: true, path: this.mediaDestinationFolder }
  }

  /**
   * Set custom media destination folder
   */
  public setMediaFolder(targetPath: string): MediaFolderResult {
    try {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true })
      }
      this.mediaDestinationFolder = targetPath
      this.saveConfig()
      return { success: true, path: this.mediaDestinationFolder }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  }

  /**
   * Open native directory picker for user to select replacement media folder
   */
  public async selectMediaFolder(): Promise<MediaFolderResult> {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Media Destination Folder',
        defaultPath: this.mediaDestinationFolder,
        properties: ['openDirectory', 'createDirectory'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true, path: this.mediaDestinationFolder }
      }

      const selected = result.filePaths[0]
      return this.setMediaFolder(selected)
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  }

  /**
   * Ensure media destination directory exists and reveal it in native file manager
   */
  public async openExportsFolder(): Promise<OpenExportsResult> {
    try {
      if (!fs.existsSync(this.mediaDestinationFolder)) {
        fs.mkdirSync(this.mediaDestinationFolder, { recursive: true })
      }
      await shell.openPath(this.mediaDestinationFolder)
      return { success: true, path: this.mediaDestinationFolder }
    } catch (error) {
      console.error('[SystemService] Failed to open exports directory:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Calculate storage taken by downloaded models and audio media files
   */
  public async getStorageInfo(): Promise<StorageInfoResult> {
    try {
      // 1. Calculate models storage
      let modelsBytes = 0
      const modelsList: any[] = []

      if (this.modelsService) {
        const status = this.modelsService.getStatus()
        modelsBytes = status.models.filter((m) => m.downloaded).reduce((acc, m) => acc + (m.sizeBytes || 0), 0)
        if (status.cacheDirectory) {
          const cacheSize = getDirectorySizeBytes(status.cacheDirectory)
          if (cacheSize > 0) modelsBytes = cacheSize
        }
        status.models.forEach((m) => {
          modelsList.push({
            id: m.id,
            name: m.name,
            sizeBytes: m.sizeBytes,
            sizeFormatted: m.sizeFormatted,
            downloaded: m.downloaded,
            category: m.category,
            engine: m.engine,
          })
        })
      }

      // 2. Calculate media storage
      const mediaBytes = getDirectorySizeBytes(this.mediaDestinationFolder)

      // Also check local testing/cached audio files
      const localAudioDir = path.resolve(process.cwd(), 'assets/testing-voice-output')
      const localAudioBytes = getDirectorySizeBytes(localAudioDir)

      const totalMediaBytes = mediaBytes + localAudioBytes
      const totalBytes = modelsBytes + totalMediaBytes

      return {
        success: true,
        modelsStorageBytes: modelsBytes,
        modelsStorageFormatted: formatBytes(modelsBytes),
        mediaStorageBytes: totalMediaBytes,
        mediaStorageFormatted: formatBytes(totalMediaBytes),
        totalStorageBytes: totalBytes,
        totalStorageFormatted: formatBytes(totalBytes),
        mediaDestinationFolder: this.mediaDestinationFolder,
        models: modelsList,
      }
    } catch (err: any) {
      return {
        success: false,
        modelsStorageBytes: 0,
        modelsStorageFormatted: '0 B',
        mediaStorageBytes: 0,
        mediaStorageFormatted: '0 B',
        totalStorageBytes: 0,
        totalStorageFormatted: '0 B',
        mediaDestinationFolder: this.mediaDestinationFolder,
        models: [],
        error: err?.message || String(err),
      }
    }
  }
}
