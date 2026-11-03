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

interface CompanionFileSpec {
  targetName: string
  expectedSize: number
}

interface ModelDiskSpec {
  id: string
  /** If this model is stored as a companion set in ~/.qvac/models/sets/<setKey>/ */
  companionSet?: {
    setKey: string
    files: CompanionFileSpec[]
  }
  /** If this model is stored as a single file in ~/.qvac/models/<hash>_<targetFileName> */
  singleFile?: {
    targetFileName: string
    expectedSize: number
  }
}

export class ModelsService {
  private cacheDir: string
  private stateFilePath: string
  private downloadedModelIds: Set<string> = new Set()
  private activeDownloads: Map<
    string,
    {
      cancel: () => void
      listeners: Set<(p: ModelDownloadProgressPayload) => void>
      lastProgress?: ModelDownloadProgressPayload
    }
  > = new Map()
  private inflightPromises: Map<string, Promise<ModelDownloadResult>> = new Map()

  // Exact disk verification specification matching @qvac/inference registry metadata
  private readonly diskSpecs: Record<string, ModelDiskSpec> = {
    'cosyvoice3-llm-q8_0': {
      id: 'cosyvoice3-llm-q8_0',
      companionSet: {
        setKey: 'b75e001ce19bae4c',
        files: [
          { targetName: 'cosyvoice3-llm-q8_0.gguf', expectedSize: 973496000 },
          { targetName: 'cosyvoice3-flow-f32.gguf', expectedSize: 1333857632 },
          { targetName: 'cosyvoice3-hift-f32.gguf', expectedSize: 83087520 },
          { targetName: 'vocab.json', expectedSize: 2776833 },
          { targetName: 'merges.txt', expectedSize: 1402109 },
          { targetName: 'voice.gguf', expectedSize: 179584 },
        ],
      },
    },
    'cosyvoice3-flow-fp16': {
      id: 'cosyvoice3-flow-fp16',
      singleFile: {
        targetFileName: 'cosyvoice3-flow-f16.gguf',
        expectedSize: 669940640,
      },
    },
    'cosyvoice3-s3tok-fp16': {
      id: 'cosyvoice3-s3tok-fp16',
      singleFile: {
        targetFileName: 'cosyvoice3-s3tok-f16.gguf',
        expectedSize: 496605536,
      },
    },
    'cosyvoice3-campplus-fp32': {
      id: 'cosyvoice3-campplus-fp32',
      singleFile: {
        targetFileName: 'cosyvoice3-campplus-f32.gguf',
        expectedSize: 27530656,
      },
    },
    'lavasr-enhancer': {
      id: 'lavasr-enhancer',
      singleFile: {
        targetFileName: 'lavasr-enhancer-f16.gguf',
        expectedSize: 28051008,
      },
    },
  }

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
      required: true,
    },
    {
      id: 'cosyvoice3-flow-fp16',
      name: 'CosyVoice 3 Flow Matching Acoustic (FP16)',
      descriptorName: 'TTS_COSYVOICE3_FLOW_COSYVOICE_FP16',
      sizeBytes: 669940640,
      sizeFormatted: '639 MB',
      description:
        'Uncompressed FP16 flow-matching ODE acoustic generator for pristine vocal detail, breath dynamics, and zero metallic distortion.',
      category: 'vocoder',
      engine: 'cosyvoice3',
      required: true,
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
      required: true,
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
      required: true,
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
      required: true,
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
    if (this.activeDownloads.has(modelId)) return false
    return this.downloadedModelIds.has(modelId)
  }

  /**
   * Strictly verifies that all files for a given modelId exist on disk with their exact expected byte sizes,
   * and that the model is not currently being downloaded.
   */
  private verifyModelFilesOnDisk(modelId: string): boolean {
    if (this.activeDownloads.has(modelId)) {
      return false
    }

    if (!fs.existsSync(this.cacheDir)) {
      return false
    }

    const spec = this.diskSpecs[modelId]
    if (!spec) {
      return false
    }

    try {
      // 1. Companion set verification: ALL files in sets/<setKey>/ must exist with exact byte size
      if (spec.companionSet) {
        const setDir = path.join(this.cacheDir, 'sets', spec.companionSet.setKey)
        if (!fs.existsSync(setDir)) {
          return false
        }
        for (const fileSpec of spec.companionSet.files) {
          const filePath = path.join(setDir, fileSpec.targetName)
          if (!fs.existsSync(filePath)) {
            return false
          }
          const st = fs.statSync(filePath)
          if (!st.isFile() || st.size !== fileSpec.expectedSize) {
            return false
          }
        }
        return true
      }

      // 2. Single file verification: file in ~/.qvac/models/ must match targetFileName and exact expectedSize
      if (spec.singleFile) {
        const targetLower = spec.singleFile.targetFileName.toLowerCase()
        const expectedSize = spec.singleFile.expectedSize
        const topFiles = fs.readdirSync(this.cacheDir)

        for (const file of topFiles) {
          const lower = file.toLowerCase()
          if (lower === targetLower || lower.endsWith(`_${targetLower}`)) {
            const fullPath = path.join(this.cacheDir, file)
            try {
              const st = fs.statSync(fullPath)
              if (st.isFile() && st.size === expectedSize) {
                return true
              }
            } catch {}
          }
        }
        return false
      }
    } catch (err) {
      console.warn(`[ModelsService] Error verifying model ${modelId} on disk:`, err)
    }

    return false
  }

  /**
   * Load persisted downloaded model status and verify cached weights on disk
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
   * Scan disk cache directory for downloaded models and strictly verify exact file sizes
   */
  public syncCacheFromDisk(): void {
    let changed = false
    try {
      for (const def of this.modelDefinitions) {
        // Never mark a model as downloaded while it has an active download in flight
        if (this.activeDownloads.has(def.id)) {
          if (this.downloadedModelIds.has(def.id)) {
            this.downloadedModelIds.delete(def.id)
            changed = true
          }
          continue
        }

        const isStrictlyValid = this.verifyModelFilesOnDisk(def.id)
        if (isStrictlyValid && !this.downloadedModelIds.has(def.id)) {
          this.downloadedModelIds.add(def.id)
          changed = true
        } else if (!isStrictlyValid && this.downloadedModelIds.has(def.id)) {
          this.downloadedModelIds.delete(def.id)
          changed = true
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
   * All 5 models are marked required so the setup screen only completes when every model is ready.
   */
  public getStatus(_selectedEngine?: AnyEngineType): VoiceModelStatusResult {
    this.syncCacheFromDisk()

    const models: VoiceModelInfo[] = this.modelDefinitions.map((def) => {
      const isDownloading = this.activeDownloads.has(def.id)
      const isDownloaded = !isDownloading && this.downloadedModelIds.has(def.id)

      return {
        ...def,
        required: true,
        downloaded: isDownloaded,
        status: isDownloading ? 'downloading' : isDownloaded ? 'ready' : 'idle',
      }
    })

    const anyDownloading = this.activeDownloads.size > 0
    const allRequiredDownloaded =
      !anyDownloading && models.length > 0 && models.every((m) => m.downloaded)

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
   * Supports concurrent downloads across models while strictly isolating each model's progress
   * and verifying exact byte sizes on disk before marking complete.
   */
  public async downloadModel(
    modelId: string,
    onProgress?: (p: ModelDownloadProgressPayload) => void
  ): Promise<ModelDownloadResult> {
    const def = this.modelDefinitions.find((m) => m.id === modelId)
    if (!def) {
      return { success: false, modelId, error: `Unknown model ID: ${modelId}` }
    }

    // If this exact model is already downloading, attach progress listener and join the existing promise
    const existingActive = this.activeDownloads.get(modelId)
    const existingPromise = this.inflightPromises.get(modelId)
    if (existingActive && existingPromise) {
      if (onProgress) {
        existingActive.listeners.add(onProgress)
        if (existingActive.lastProgress) {
          try {
            onProgress(existingActive.lastProgress)
          } catch {}
        }
      }
      return existingPromise
    }

    this.syncCacheFromDisk()

    if (this.downloadedModelIds.has(modelId) && this.verifyModelFilesOnDisk(modelId)) {
      onProgress?.({
        modelId,
        percentage: 100,
        downloaded: def.sizeBytes,
        total: def.sizeBytes,
        speed: 'Completed',
      })
      return { success: true, modelId }
    }

    let isCancelled = false
    let currentRequestCancel: (() => void) | null = null
    const listeners = new Set<(p: ModelDownloadProgressPayload) => void>()
    if (onProgress) {
      listeners.add(onProgress)
    }

    const activeEntry = {
      listeners,
      lastProgress: undefined as ModelDownloadProgressPayload | undefined,
      cancel: () => {
        isCancelled = true
        if (currentRequestCancel) {
          currentRequestCancel()
        }
      },
    }

    const broadcast = (payload: ModelDownloadProgressPayload) => {
      activeEntry.lastProgress = payload
      for (const listener of listeners) {
        try {
          listener(payload)
        } catch {}
      }
    }

    // Register in activeDownloads and ensure it is not marked downloaded while in flight
    this.downloadedModelIds.delete(modelId)
    this.activeDownloads.set(modelId, activeEntry)

    broadcast({
      modelId,
      percentage: 0,
      downloaded: 0,
      total: def.sizeBytes,
      speed: 'Connecting...',
    })

    const runDownload = async (): Promise<ModelDownloadResult> => {
      let lastPct = 0
      let totalModelBytes = def.sizeBytes

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

        const isCompanionModel = Boolean(this.diskSpecs[modelId]?.companionSet)

        let lastErr: any = null
        for (let attempt = 1; attempt <= 3; attempt++) {
          if (isCancelled) break
          try {
            const downloadPromise = qvacSdk.downloadAsset({
              assetSrc: sdkDescriptor,
              onProgress: (p: any) => {
                if (isCancelled) return

                // For companion sets, only trust fileSetInfo for overall progress so single-file 100% frames don't spike progress
                if (isCompanionModel && !p.fileSetInfo) {
                  return
                }

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
                  0

                // Compute exact ratio from bytes when available to avoid premature Math.round(99.6) -> 100
                const byteRatioPct =
                  totalBytes > 0
                    ? Math.floor((downloadedBytes / totalBytes) * 100)
                    : Math.floor(
                        p.fileSetInfo?.overallPercentage ??
                          p.shardInfo?.overallPercentage ??
                          p.percentage ??
                          0
                      )

                // Cap in-flight progress at 99% until downloadPromise resolves and disk verification passes
                const currentPct = Math.min(99, Math.max(0, byteRatioPct))
                lastPct = Math.max(lastPct, currentPct)

                let speed = p.speed || 'Downloading...'
                if (totalBytes > 0 && downloadedBytes >= totalBytes) {
                  speed = 'Verifying checksum...'
                } else if (p.fileSetInfo?.currentFile) {
                  speed = `${p.fileSetInfo.currentFile} (${p.fileSetInfo.fileIndex}/${p.fileSetInfo.totalFiles})`
                } else if (p.shardInfo?.shardName) {
                  speed = `${p.shardInfo.shardName} (${p.shardInfo.currentShard}/${p.shardInfo.totalShards})`
                }

                broadcast({
                  modelId,
                  percentage: lastPct,
                  downloaded: downloadedBytes,
                  total: totalBytes,
                  speed,
                })
              },
            })

            if (downloadPromise && downloadPromise.requestId) {
              currentRequestCancel = () => {
                try {
                  if (typeof (qvacSdk as any).cancel === 'function') {
                    ;(qvacSdk as any).cancel({
                      requestId: downloadPromise.requestId,
                    })
                  }
                } catch {}
              }
            }

            await downloadPromise
            lastErr = null
            break
          } catch (err: any) {
            lastErr = err
            const msg = String(err?.message || err)
            if (
              (msg.includes('could not be locked') || msg.includes('REQUEST_TIMEOUT')) &&
              attempt < 3 &&
              !isCancelled
            ) {
              console.warn(
                `[ModelsService] Transient download error for ${modelId} (attempt ${attempt}/3). Retrying...`
              )
              await new Promise((r) => setTimeout(r, 1200 * attempt))
              continue
            }
            throw err
          }
        }

        if (lastErr) throw lastErr

        if (isCancelled) {
          return { success: false, modelId, error: 'Download cancelled' }
        }

        // Remove from activeDownloads BEFORE verifying on disk so verifyModelFilesOnDisk can inspect it
        this.activeDownloads.delete(modelId)
        this.inflightPromises.delete(modelId)

        // Strictly verify that all expected files and exact byte sizes are present on disk
        const verified = this.verifyModelFilesOnDisk(modelId)
        if (!verified) {
          this.syncCacheFromDisk()
          return {
            success: false,
            modelId,
            error: `Downloaded files for ${modelId} did not pass disk size verification.`,
          }
        }

        this.downloadedModelIds.add(modelId)
        this.syncCacheFromDisk()
        this.saveState()

        broadcast({
          modelId,
          percentage: 100,
          downloaded: totalModelBytes,
          total: totalModelBytes,
          speed: 'Completed',
        })

        return { success: true, modelId }
      } catch (err) {
        this.activeDownloads.delete(modelId)
        this.inflightPromises.delete(modelId)
        this.syncCacheFromDisk()
        console.error(`[ModelsService] Download error for ${modelId}:`, err)
        return { success: false, modelId, error: String(err) }
      } finally {
        this.activeDownloads.delete(modelId)
        this.inflightPromises.delete(modelId)
      }
    }

    const taskPromise = runDownload()
    this.inflightPromises.set(modelId, taskPromise)
    return taskPromise
  }

  /**
   * Cancel an in-flight download
   */
  public cancelDownload(modelId: string): boolean {
    const active = this.activeDownloads.get(modelId)
    if (active) {
      active.cancel()
      this.activeDownloads.delete(modelId)
      this.inflightPromises.delete(modelId)
      this.syncCacheFromDisk()
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
    this.inflightPromises.clear()

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
