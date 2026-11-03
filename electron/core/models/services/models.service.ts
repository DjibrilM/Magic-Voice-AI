import '../../../init-env'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { app } from 'electron'
import * as qvacSdk from '@qvac/sdk'

import type {
  AnyEngineType,
  VoiceModelInfo,
  VoiceModelStatusResult,
  ModelDownloadProgressPayload,
  ModelDownloadResult,
} from '../interfaces'

export class ModelsService {
  private cacheDir: string
  private stateFilePath: string
  private downloadedModelIds: Set<string> = new Set()
  private activeDownloads: Map<string, { cancel: () => void }> = new Map()

  // Full specification of CosyVoice 3 TTS voice models
  private readonly modelDefinitions: Omit<VoiceModelInfo, 'downloaded' | 'status'>[] = [
    {
      id: 'cosyvoice3-llm-q8_0',
      name: 'CosyVoice 3 Speech Backbone (0.5B, Q8_0)',
      descriptorName: 'TTS_COSYVOICE3_LLM_COSYVOICE_Q8_0',
      sizeBytes: 973496000,
      sizeFormatted: '973 MB',
      description:
        'Zero-shot speech generator with instruct conditioning for voice design & cloning (optimized for Apple Silicon / M-series).',
      category: 'backbone',
      engine: 'cosyvoice3',
      required: false,
    },
    {
      id: 'cosyvoice3-flow-fp16',
      name: 'CosyVoice 3 Flow Matching Acoustic (FP16)',
      descriptorName: 'TTS_COSYVOICE3_FLOW_COSYVOICE_FP16',
      sizeBytes: 669966336,
      sizeFormatted: '639 MB',
      description:
        'Uncompressed FP16 flow-matching ODE acoustic generator for pristine vocal detail, breath dynamics, and zero metallic distortion.',
      category: 'vocoder',
      engine: 'cosyvoice3',
      required: false,
    },
    {
      id: 'lavasr-enhancer',
      name: 'Lava-SR 48kHz Enhancer (FP16)',
      descriptorName: 'TTS_ENHANCER_LAVASR_FP16',
      sizeBytes: 28051008,
      sizeFormatted: '28 MB',
      description:
        'Deep spectral bandwidth upsampler and harmonic clarity enhancer for studio-grade 48kHz ultra-HD audio.',
      category: 'enhancer',
      engine: 'shared',
      required: false,
    },
    {
      id: 'cosyvoice3-s3tok-fp16',
      name: 'CosyVoice 3 S3Tok Speech Tokenizer (FP16)',
      descriptorName: 'TTS_COSYVOICE3_S3TOK_COSYVOICE_FP16',
      sizeBytes: 496605536,
      sizeFormatted: '496 MB',
      description:
        'Speech tokenizer required for high-fidelity instant voice cloning in CosyVoice 3.',
      category: 'vocoder',
      engine: 'cosyvoice3',
      required: false,
    },
    {
      id: 'cosyvoice3-campplus-fp32',
      name: 'CosyVoice 3 CAM++ Speaker Encoder (FP32)',
      descriptorName: 'TTS_COSYVOICE3_CAMPPLUS_COSYVOICE_FP32',
      sizeBytes: 27530656,
      sizeFormatted: '27 MB',
      description:
        'Deep acoustic timbre and speaker embedding extractor for voice cloning in CosyVoice 3.',
      category: 'multilingual',
      engine: 'cosyvoice3',
      required: false,
    },
  ]

  constructor() {
    this.cacheDir = path.join(os.homedir(), '.qvac', 'models')
    const userData = app ? app.getPath('userData') : path.join(os.homedir(), '.echo-ai')
    if (!fs.existsSync(userData)) {
      try {
        fs.mkdirSync(userData, { recursive: true })
      } catch {}
    }
    this.stateFilePath = path.join(userData, 'voice_engine_state.json')
    this.loadState()
  }

  /**
   * Returns list of configured model definitions
   */
  public getDefinitions() {
    return this.modelDefinitions
  }

  /**
   * Fast check if a specific model is downloaded and ready
   */
  public isModelDownloaded(modelId: string): boolean {
    if (this.downloadedModelIds.has(modelId)) return true;
    for (const id of this.downloadedModelIds) {
      if (id === modelId) return true;
      if (id.startsWith(modelId) || modelId.startsWith(id)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Load persisted downloaded model status and discover cached weights
   */
  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data.downloadedModelIds)) {
          this.downloadedModelIds = new Set(data.downloadedModelIds)
        }
      }
    } catch (e) {
      console.warn('[ModelsService] Could not load state file:', e)
    }

    this.syncCacheFromDisk()
  }

  /**
   * Persist state to disk
   */
  private saveState(): void {
    try {
      const data = {
        downloadedModelIds: Array.from(this.downloadedModelIds),
        updatedAt: new Date().toISOString(),
      }
      fs.writeFileSync(this.stateFilePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      console.warn('[ModelsService] Could not save state file:', e)
    }
  }

  /**
   * Scan disk cache directory for downloaded models and verify their file presence/integrity
   */
  public syncCacheFromDisk(): void {
    let changed = false
    try {
      if (fs.existsSync(this.cacheDir)) {
        const foundModelIds = new Set<string>()

        const checkFileOrDir = (filePath: string, filename: string) => {
          const lower = filename.toLowerCase()

          // Skip temporary/incomplete download files
          if (
            lower.endsWith('.download') ||
            lower.endsWith('.tmp') ||
            lower.endsWith('.partial') ||
            lower.endsWith('.crdownload')
          ) {
            return
          }

          let stats: fs.Stats | null = null
          try {
            stats = fs.statSync(filePath)
          } catch {
            return
          }

          // Ensure file is not an empty 0-byte or corrupted artifact (must be at least 1MB)
          const isAdequateSize = stats.isFile() && stats.size > 1024 * 1024
          if (!isAdequateSize) return

          if (lower.includes('cosyvoice3-llm') || lower.includes('cosy_voice')) {
            foundModelIds.add('cosyvoice3-llm-q8_0')
          }
          if (
            lower.includes('cosyvoice3-flow-f16') ||
            lower.includes('cosyvoice3-flow-fp16') ||
            lower.includes('cosyvoice3-flow-f32') ||
            lower.includes('cosyvoice3-flow')
          ) {
            foundModelIds.add('cosyvoice3-flow-fp16')
          }
          if (lower.includes('lavasr') || lower.includes('enhancer')) {
            foundModelIds.add('lavasr-enhancer')
          }
          if (lower.includes('cosyvoice3-s3tok') || lower.includes('s3tok')) {
            foundModelIds.add('cosyvoice3-s3tok-fp16')
          }
          if (lower.includes('cosyvoice3-campplus') || lower.includes('campplus')) {
            foundModelIds.add('cosyvoice3-campplus-fp32')
          }
        }

        const topFiles = fs.readdirSync(this.cacheDir)
        for (const file of topFiles) {
          const fullPath = path.join(this.cacheDir, file)
          checkFileOrDir(fullPath, file)
        }

        // Check companion sets layout (e.g. ~/.qvac/models/sets/<set_hash>/...)
        const setsDir = path.join(this.cacheDir, 'sets')
        if (fs.existsSync(setsDir)) {
          const setDirs = fs.readdirSync(setsDir)
          for (const sd of setDirs) {
            const setPath = path.join(setsDir, sd)
            try {
              if (fs.existsSync(setPath)) {
                const setFiles = fs.readdirSync(setPath)
                for (const sf of setFiles) {
                  const subFilePath = path.join(setPath, sf)
                  checkFileOrDir(subFilePath, sf)
                }
              }
            } catch {}
          }
        }

        // Add discovered models
        for (const id of foundModelIds) {
          if (!this.downloadedModelIds.has(id)) {
            this.downloadedModelIds.add(id)
            changed = true
          }
        }

        // Prune any models that are NOT found on disk (strictly prevents false downloads)
        for (const id of Array.from(this.downloadedModelIds)) {
          if (
            (id.startsWith('cosyvoice3-') || id === 'lavasr-enhancer') &&
            !foundModelIds.has(id)
          ) {
            this.downloadedModelIds.delete(id)
            changed = true
          }
        }
      }
    } catch (err) {
      console.warn('[ModelsService] Error syncing cache from disk:', err)
    }

    if (changed) {
      this.saveState()
    }
  }

  /**
   * Get complete status of all CosyVoice 3 voice engine models.
   * CosyVoice 3 requires: backbone, enhancer, s3tok, campplus (flow is optional high precision).
   */
  public getStatus(_selectedEngine?: AnyEngineType): VoiceModelStatusResult {
    this.syncCacheFromDisk()

    const models: VoiceModelInfo[] = this.modelDefinitions.map((def) => {
      const isDownloaded = this.downloadedModelIds.has(def.id)
      const isDownloading = this.activeDownloads.has(def.id)

      // CosyVoice 3 requires core models (flow-fp16 is an optional high-precision upgrade).
      const isRequired =
        (def.engine === 'cosyvoice3' && def.id !== 'cosyvoice3-flow-fp16') ||
        def.engine === 'shared'

      return {
        ...def,
        required: isRequired,
        downloaded: isDownloaded,
        status: isDownloading ? 'downloading' : isDownloaded ? 'ready' : 'idle',
      }
    })

    const activeRequiredModels = models.filter((m) => m.required)
    const allRequiredDownloaded =
      activeRequiredModels.length > 0 && activeRequiredModels.every((m) => m.downloaded)

    return {
      ready: allRequiredDownloaded,
      allRequiredDownloaded,
      models,
      cacheDirectory: this.cacheDir,
    }
  }

  /**
   * Helper to check if an engine is fully ready for speech synthesis
   */
  public areAllRequiredModelsDownloaded(selectedEngine: AnyEngineType = 'cosyvoice3'): boolean {
    const status = this.getStatus(selectedEngine)
    return status.allRequiredDownloaded
  }

  /**
   * Download a single model with live progress updates.
   * Correctly handles single-file, sharded, and companion set downloads with smooth monotonic percentages.
   */
  public async downloadModel(
    modelId: string,
    onProgress?: (p: ModelDownloadProgressPayload) => void
  ): Promise<ModelDownloadResult> {
    const def = this.modelDefinitions.find((m) => m.id === modelId)
    if (!def) {
      return { success: false, modelId, error: `Unknown model ID: ${modelId}` }
    }

    this.syncCacheFromDisk()

    if (this.downloadedModelIds.has(modelId)) {
      onProgress?.({
        modelId,
        percentage: 100,
        downloaded: def.sizeBytes,
        total: def.sizeBytes,
        speed: 'Ready',
      })
      return { success: true, modelId }
    }

    let isCancelled = false
    let lastPct = 0
    let totalModelBytes = def.sizeBytes
    this.activeDownloads.set(modelId, {
      cancel: () => {
        isCancelled = true
      },
    })

    try {
      const sdk: any = qvacSdk as any
      const sdkDescriptor: any = sdk[def.descriptorName] || null

      if (!sdkDescriptor || typeof qvacSdk.downloadAsset !== 'function') {
        return {
          success: false,
          modelId,
          error: `No asset descriptor found for ${modelId} (${def.descriptorName})`,
        }
      }

      let lastErr: any = null
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const downloadPromise = qvacSdk.downloadAsset({
            assetSrc: sdkDescriptor,
            onProgress: (p: any) => {
              if (isCancelled) return

              // Multi-file companion sets emit fileSetInfo, sharded emit shardInfo, single emit percentage
              const overallPct =
                p.fileSetInfo?.overallPercentage ??
                p.shardInfo?.overallPercentage ??
                (p.fileSetInfo || p.shardInfo ? 0 : p.percentage ?? 0)

              const totalBytes =
                p.fileSetInfo?.overallTotal ??
                p.shardInfo?.overallTotal ??
                p.total ??
                def.sizeBytes

              totalModelBytes = totalBytes

              const downloadedBytes =
                p.fileSetInfo?.overallDownloaded ??
                p.shardInfo?.overallDownloaded ??
                p.downloaded ??
                Math.round(((overallPct || 0) / 100) * totalBytes)

              const currentPct = Math.min(99, Math.max(1, Math.round(overallPct || 0)))
              lastPct = Math.max(lastPct, currentPct)

              let speed = p.speed || 'Downloading...'
              if (p.fileSetInfo?.currentFile) {
                speed = `${p.fileSetInfo.currentFile} (${p.fileSetInfo.fileIndex}/${p.fileSetInfo.totalFiles})`
              } else if (p.shardInfo?.shardName) {
                speed = `${p.shardInfo.shardName} (${p.shardInfo.currentShard}/${p.shardInfo.totalShards})`
              }

              // Check if model is fully downloaded (progress.downloaded >= progress.total or percentage >= 100)
              const isFinished = (downloadedBytes >= totalBytes && totalBytes > 0) || overallPct >= 100
              if (isFinished) {
                this.downloadedModelIds.add(modelId)
                this.syncCacheFromDisk()
                this.saveState()
              }

              onProgress?.({
                modelId,
                percentage: isFinished ? 100 : lastPct,
                downloaded: downloadedBytes,
                total: totalBytes,
                speed: isFinished ? 'Completed' : speed,
              })
            },
          })

          if (downloadPromise && downloadPromise.requestId) {
            this.activeDownloads.set(modelId, {
              cancel: () => {
                isCancelled = true
                try {
                  if (typeof (qvacSdk as any).cancel === 'function') {
                    ;(qvacSdk as any).cancel({
                      requestId: downloadPromise.requestId,
                    })
                  }
                } catch {}
              },
            })
          }

          await downloadPromise
          lastErr = null
          break
        } catch (err: any) {
          lastErr = err
          const msg = String(err?.message || err)
          if (msg.includes('could not be locked') && attempt === 1 && !isCancelled) {
            console.warn(`[ModelsService] Registry lock conflict for ${modelId}. Retrying in 1.2s...`)
            await new Promise((r) => setTimeout(r, 1200))
            continue
          }
          throw err
        }
      }

      if (lastErr) throw lastErr

      if (isCancelled) {
        return { success: false, modelId, error: 'Download cancelled' }
      }

      this.downloadedModelIds.add(modelId)
      this.syncCacheFromDisk()
      this.saveState()

      onProgress?.({
        modelId,
        percentage: 100,
        downloaded: totalModelBytes,
        total: totalModelBytes,
        speed: 'Completed',
      })

      return { success: true, modelId }
    } catch (err) {
      console.error(`[ModelsService] Download error for ${modelId}:`, err)
      return { success: false, modelId, error: String(err) }
    } finally {
      this.activeDownloads.delete(modelId)
    }
  }

  /**
   * Cancel an in-flight download
   */
  public cancelDownload(modelId: string): boolean {
    const active = this.activeDownloads.get(modelId)
    if (active) {
      active.cancel()
      this.activeDownloads.delete(modelId)
      return true
    }
    return false
  }

  /**
   * Delete all installed models from disk and reset internal state
   */
  public async deleteAllModels(): Promise<boolean> {
    // Cancel any active downloads first
    for (const [modelId, download] of this.activeDownloads.entries()) {
      try {
        download.cancel()
      } catch {}
      this.activeDownloads.delete(modelId)
    }

    this.downloadedModelIds.clear()
    this.saveState()

    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir)
        for (const file of files) {
          const fullPath = path.join(this.cacheDir, file)
          try {
            const st = fs.statSync(fullPath)
            if (st.isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true })
            } else {
              fs.unlinkSync(fullPath)
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[ModelsService] Error deleting cache directory:', err)
    }

    return true
  }

  /**
   * Query QVAC model info using @qvac/sdk getModelInfo
   */
  public async getModelInfo(name: string): Promise<any> {
    return qvacSdk.getModelInfo({ name })
  }
}
