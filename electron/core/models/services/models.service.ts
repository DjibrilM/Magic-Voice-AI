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

  // Full specification of neural TTS voice models
  private readonly modelDefinitions: Omit<VoiceModelInfo, 'downloaded' | 'status'>[] = [
    {
      id: 'chatterbox-t3-turbo-q8_0',
      name: 'Chatterbox T3 Turbo Backbone (Q8_0 GGUF)',
      descriptorName: 'TTS_T3_TURBO_EN_CHATTERBOX_Q8_0',
      sizeBytes: 487091392,
      sizeFormatted: '487 MB',
      description:
        'Fast and expressive autoregressive T3 speech backbone with high dynamic range and instant voice cloning.',
      category: 'backbone',
      engine: 'chatterbox',
      required: false,
    },
    {
      id: 'chatterbox-s3gen-q8_0',
      name: 'Chatterbox S3Gen Acoustic Vocoder (Q8_0 GGUF)',
      descriptorName: 'TTS_S3GEN_EN_CHATTERBOX_Q8_0',
      sizeBytes: 829702464,
      sizeFormatted: '830 MB',
      description:
        'Companion diffusion vocoder for realistic breath, timbre, and natural prosody in Chatterbox speech.',
      category: 'vocoder',
      engine: 'chatterbox',
      required: false,
    },
    {
      id: 'chatterbox-t3-multilingual-q8_0',
      name: 'Chatterbox T3 Multilingual (23 Languages, Q8_0)',
      descriptorName: 'TTS_T3_MULTILINGUAL_CHATTERBOX_Q8_0',
      sizeBytes: 487091392,
      sizeFormatted: '487 MB',
      description:
        'Multilingual T3 speech model supporting 23 international languages with cross-lingual voice cloning.',
      category: 'backbone',
      engine: 'chatterbox',
      required: false,
    },
    {
      id: 'chatterbox-s3gen-multilingual-q8_0',
      name: 'Chatterbox S3Gen Multilingual Vocoder (Q8_0)',
      descriptorName: 'TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q8_0',
      sizeBytes: 829702464,
      sizeFormatted: '830 MB',
      description:
        'Multilingual diffusion vocoder generating clean, natural acoustic waveforms across 23 languages.',
      category: 'vocoder',
      engine: 'chatterbox',
      required: false,
    },
    {
      id: 'cosyvoice3-llm-q8_0',
      name: 'CosyVoice 3 Neural Speech Backbone (0.5B, Q8_0)',
      descriptorName: 'TTS_COSYVOICE3_LLM_COSYVOICE_Q8_0',
      sizeBytes: 973496000,
      sizeFormatted: '973 MB',
      description:
        'Zero-shot neural speech generator with instruct conditioning for voice design & cloning (optimized for Apple Silicon / M-series).',
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
      name: 'Lava-SR 48kHz Neural Enhancer (FP16)',
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
        'Neural speech tokenizer required for high-fidelity instant voice cloning in CosyVoice 3.',
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
    // Music Generation Models (ACE-Step & MiniMax AudioGen)
    {
      id: 'audiogen-qwen3-embedding',
      name: 'Qwen3 Embedding Text Encoder (0.6B Q8_0)',
      descriptorName: 'AUDIOGEN_QWEN3_EMBEDDING_0_6B_Q8_0',
      sizeBytes: 784144960,
      sizeFormatted: '784 MB',
      description:
        'Encodes captions, prompts, and vocal lyrics into continuous musical semantic space.',
      category: 'text-encoder',
      engine: 'acestep',
      required: true,
    },
    {
      id: 'audiogen-acestep-5hz-lm',
      name: 'ACE-Step 5Hz Language Model (0.6B Q8_0)',
      descriptorName: 'AUDIOGEN_ACESTEP_5HZ_LM_0_6B_Q8_0',
      sizeBytes: 709846656,
      sizeFormatted: '710 MB',
      description:
        'Plans song structure, tempo, arrangement, and section transitions at 5 Hz.',
      category: 'lm',
      engine: 'acestep',
      required: true,
    },
    {
      id: 'audiogen-acestep-turbo-dit',
      name: 'ACE-Step v1.5 Turbo DiT (Q4_K_M)',
      descriptorName: 'AUDIOGEN_ACESTEP_V15_TURBO_Q4_K_M',
      sizeBytes: 1445710272,
      sizeFormatted: '1.45 GB',
      description:
        'Fast 8-step Diffusion Transformer with Haar DCW for expressive music audio latents.',
      category: 'dit',
      engine: 'acestep',
      required: true,
    },
    {
      id: 'audiogen-vae-bf16',
      name: 'ACE-Step Audio VAE (BF16)',
      descriptorName: 'AUDIOGEN_VAE_BF16',
      sizeBytes: 337420928,
      sizeFormatted: '337 MB',
      description:
        'Acoustic decoder rendering pristine 48 kHz stereo PCM audio waveforms.',
      category: 'vae',
      engine: 'acestep',
      required: true,
    },
    {
      id: 'minimax-music-v3-transformer',
      name: 'MiniMax Music-v3 Global LM (Q4_K_M GGUF)',
      descriptorName: 'MINIMAX_MUSIC_V3_TRANSFORMER',
      sizeBytes: 5512456672,
      sizeFormatted: '5.13 GB',
      description:
        'Qwen3-8B based global language model with extended audio vocabulary, planning semantic music structures.',
      category: 'lm',
      engine: 'minimax',
      required: true,
    },
    {
      id: 'minimax-music-vocoder',
      name: 'MiniMax Music-v3 Synth Stack (Q4_K_M GGUF)',
      descriptorName: 'MINIMAX_MUSIC_VOCODER',
      sizeBytes: 2131105508,
      sizeFormatted: '1.98 GB',
      description:
        'Full synthesis pipeline: RVQ depth decoder, condition encoder, flow-matching DiT, and stereo vocoder.',
      category: 'vocoder',
      engine: 'minimax',
      required: true,
    },
    {
      id: 'qwen3-1.7b-lyric-generator',
      name: 'Qwen3-1.7B Lyric Generator (Q4_0 GGUF)',
      descriptorName: 'QWEN3_1_7B_INST_Q4',
      sizeBytes: 1056782912,
      sizeFormatted: '1.05 GB',
      description:
        'Local 1.7B Instruct LLM for composing rhyming song lyrics, verse/chorus structures, and stylistic themes from prompts.',
      category: 'lm',
      engine: 'minimax',
      required: true,
    },
    // Story Generation & Narrative Engine Models
    {
      id: 'gemma-4-4b-multimodal-q6_k',
      name: 'Gemma 4 Multimodal 4B (Q6_K GGUF)',
      descriptorName: 'GEMMA4_4B_MULTIMODAL_Q6_K',
      sizeBytes: 3410000000,
      sizeFormatted: '3.41 GB',
      description:
        'Local Gemma 4 multimodal model for multi-agent narrative orchestration, world building, and dialogue generation.',
      category: 'lm',
      engine: 'story',
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
    if (this.downloadedModelIds.has(modelId)) return true;
    for (const id of this.downloadedModelIds) {
      if (id === modelId) return true;
      if (id.startsWith(modelId) || (modelId.startsWith(id) && !modelId.startsWith('minimax-'))) {
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

          if (lower.includes('parler-large-v1-f16') || lower.includes('parler-large-v1-fp16')) {
            foundModelIds.add('chatterbox-t3-turbo-q8_0')
          } else if (lower.includes('chatterbox-s3gen-q8') || lower.includes('chatterbox-s3gen')) {
            foundModelIds.add('chatterbox-s3gen-q8_0')
          } else if (lower.includes('chatterbox-t3-multilingual')) {
            foundModelIds.add('chatterbox-t3-multilingual-q8_0')
          } else if (lower.includes('chatterbox-s3gen-multilingual')) {
            foundModelIds.add('chatterbox-s3gen-multilingual-q8_0')
          } else if (lower.includes('chatterbox-t3') || lower.includes('chatterbox')) {
            foundModelIds.add('chatterbox-t3-turbo-q8_0')
          }

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

          // Music Models disk presence detection
          if (lower.includes('qwen3-embedding') || lower.includes('qwen3_embedding')) {
            foundModelIds.add('audiogen-qwen3-embedding')
          }
          if (lower.includes('acestep-5hz') || lower.includes('acestep_5hz')) {
            foundModelIds.add('audiogen-acestep-5hz-lm')
          }
          if (lower.includes('acestep-v15-turbo') || lower.includes('acestep_v15_turbo') || lower.includes('turbo-q4_k_m')) {
            foundModelIds.add('audiogen-acestep-turbo-dit')
          }
          if (lower.includes('vae-bf16') || lower.includes('audiogen-vae') || lower.includes('audiogen_vae')) {
            foundModelIds.add('audiogen-vae-bf16')
          }
          if (
            (lower.includes('mm3-lm') || (lower.includes('minimax') && (lower.includes('transformer') || lower.includes('lm')))) &&
            !lower.includes('vocoder') &&
            !lower.includes('synth')
          ) {
            foundModelIds.add('minimax-music-v3-transformer')
          }
          if (
            (lower.includes('mm3-synth') || (lower.includes('minimax') && (lower.includes('vocoder') || lower.includes('synth')))) &&
            !lower.includes('transformer') &&
            !lower.includes('lm')
          ) {
            foundModelIds.add('minimax-music-vocoder')
          }
          if (
            (lower.includes('qwen3-1.7b') || lower.includes('qwen3_1.7b') || lower.includes('qwen3-1_7b') || lower.includes('qwen3-1-7b')) &&
            lower.endsWith('.gguf')
          ) {
            foundModelIds.add('qwen3-1.7b-lyric-generator')
          }

          // Story Models disk presence detection (Gemma 4 Multimodal)
          if (
            (lower.includes('gemma-4') || lower.includes('gemma_4') || lower.includes('gemma4')) &&
            lower.endsWith('.gguf')
          ) {
            foundModelIds.add('gemma-4-4b-multimodal-q6_k')
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
            (id.startsWith('minimax-') ||
              id.startsWith('audiogen-') ||
              id.startsWith('qwen3-') ||
              id.startsWith('gemma-') ||
              id.startsWith('cosyvoice3-') ||
              id === 'lavasr-enhancer') &&
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
   * Get complete status of all voice engine models scoped to the selected engine.
   * CosyVoice 3 requires: backbone, enhancer, s3tok, campplus (flow is optional high precision).
   * Parler requires any downloaded Parler backbone model.
   */
  public getStatus(selectedEngine?: AnyEngineType): VoiceModelStatusResult {
    this.syncCacheFromDisk()

    const models: VoiceModelInfo[] = this.modelDefinitions.map((def) => {
      const isDownloaded = this.downloadedModelIds.has(def.id)
      const isDownloading = this.activeDownloads.has(def.id)

      // CosyVoice 3 requires core models (flow-fp16 is an optional high-precision upgrade).
      // Chatterbox requires backbone and companion vocoder.
      // ACE-Step and MiniMax require their respective engine models.
      // Story engine requires Gemma 4 LLM and CosyVoice 3 voice suite.
      const isRequired = selectedEngine
        ? selectedEngine === 'story'
          ? def.engine === 'story' || (def.engine === 'cosyvoice3' && def.id !== 'cosyvoice3-flow-fp16') || def.id === 'lavasr-enhancer'
          : selectedEngine === 'cosyvoice3'
            ? (def.engine === 'cosyvoice3' && def.id !== 'cosyvoice3-flow-fp16') || def.engine === 'shared'
            : selectedEngine === 'chatterbox'
              ? def.engine === 'chatterbox' && (def.id === 'chatterbox-t3-turbo-q8_0' || def.id === 'chatterbox-s3gen-q8_0')
              : def.engine === selectedEngine
        : def.category === 'backbone'

      return {
        ...def,
        required: isRequired,
        downloaded: isDownloaded,
        status: isDownloading ? 'downloading' : isDownloaded ? 'ready' : 'idle',
      }
    })

    let allRequiredDownloaded = false
    if (selectedEngine === 'chatterbox') {
      const hasBackbone = models.some(
        (m) => m.engine === 'chatterbox' && m.category === 'backbone' && m.downloaded
      )
      const hasVocoder = models.some(
        (m) => m.engine === 'chatterbox' && m.category === 'vocoder' && m.downloaded
      )
      allRequiredDownloaded = hasBackbone && hasVocoder
    } else {
      const activeRequiredModels = selectedEngine
        ? models.filter((m) => m.required)
        : models.filter((m) => m.category === 'backbone')

      allRequiredDownloaded =
        activeRequiredModels.length > 0 && activeRequiredModels.every((m) => m.downloaded)
    }

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

    if (def.engine === 'minimax') {
      return await this.downloadMiniMaxModel(modelId, def, onProgress)
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

  /**
   * Directly downloads MiniMax-Music3 GGUF models from Hugging Face repository
   * with streaming progress, real byte metrics, and cancellation support.
   */
  private async downloadMiniMaxModel(
    modelId: string,
    def: Omit<VoiceModelInfo, 'downloaded' | 'status'>,
    onProgress?: (p: ModelDownloadProgressPayload) => void
  ): Promise<ModelDownloadResult> {
    const modelUrls: Record<string, { url: string; filename: string }> = {
      'minimax-music-v3-transformer': {
        url: 'https://huggingface.co/scragnog/MiniMax-Music3-GGUF/resolve/main/mm3-lm-Q4_K_M-imat.gguf',
        filename: 'mm3-lm-Q4_K_M-imat.gguf',
      },
      'minimax-music-vocoder': {
        url: 'https://huggingface.co/scragnog/MiniMax-Music3-GGUF/resolve/main/mm3-synth-Q4_K_M.gguf',
        filename: 'mm3-synth-Q4_K_M.gguf',
      },
      'qwen3-1.7b-lyric-generator': {
        url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_0.gguf',
        filename: 'Qwen3-1.7B-Q4_0.gguf',
      },
    }

    const target = modelUrls[modelId]
    if (!target) {
      return { success: false, modelId, error: `Unknown MiniMax model: ${modelId}` }
    }

    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true })
      } catch (err) {
        return { success: false, modelId, error: `Failed to create cache directory: ${err}` }
      }
    }

    const finalPath = path.join(this.cacheDir, target.filename)
    const tempPath = path.join(this.cacheDir, `${target.filename}.download`)

    // Check if valid model already exists on disk (at least 1MB)
    try {
      if (fs.existsSync(finalPath)) {
        const stats = fs.statSync(finalPath)
        if (stats.size > 1024 * 1024) {
          this.downloadedModelIds.add(modelId)
          this.syncCacheFromDisk()
          this.saveState()
          onProgress?.({
            modelId,
            percentage: 100,
            downloaded: stats.size,
            total: stats.size,
            speed: 'Ready',
          })
          return { success: true, modelId }
        }
      }

      // Check if file exists with hash prefix (e.g. f7cce66406dee646_Qwen3-1.7B-Q4_0.gguf)
      const existingFiles = fs.readdirSync(this.cacheDir)
      const matchingFile = existingFiles.find((f) => f.toLowerCase().endsWith(target.filename.toLowerCase()))
      if (matchingFile) {
        const stats = fs.statSync(path.join(this.cacheDir, matchingFile))
        if (stats.size > 1024 * 1024) {
          this.downloadedModelIds.add(modelId)
          this.syncCacheFromDisk()
          this.saveState()
          onProgress?.({
            modelId,
            percentage: 100,
            downloaded: stats.size,
            total: stats.size,
            speed: 'Ready',
          })
          return { success: true, modelId }
        }
      }
    } catch {}

    const controller = new AbortController()
    let isCancelled = false
    this.activeDownloads.set(modelId, {
      cancel: () => {
        isCancelled = true
        controller.abort()
      },
    })

    // Clean up any stale partial download
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath)
      } catch {}
    }

    let fileStream: fs.WriteStream | null = null

    try {
      const response = await fetch(target.url, {
        signal: controller.signal,
        redirect: 'follow',
      })

      if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch ${target.url}: HTTP ${response.status} ${response.statusText}`)
      }

      const contentLengthHeader = response.headers.get('content-length')
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : def.sizeBytes

      fileStream = fs.createWriteStream(tempPath)
      const reader = response.body.getReader()

      let downloadedBytes = 0
      let lastReportTime = Date.now()
      let lastReportBytes = 0
      let speedFormatted = 'Starting...'

      onProgress?.({
        modelId,
        percentage: 1,
        downloaded: 0,
        total: totalBytes,
        speed: speedFormatted,
      })

      while (true) {
        if (isCancelled) {
          throw new Error('Download cancelled')
        }

        const { done, value } = await reader.read()
        if (done) break

        if (value && value.length > 0) {
          const canContinue = fileStream.write(Buffer.from(value))
          downloadedBytes += value.length

          if (!canContinue) {
            await new Promise<void>((resolve) => fileStream!.once('drain', resolve))
          }

          const now = Date.now()
          const timeDelta = now - lastReportTime
          if (timeDelta >= 400 || downloadedBytes >= totalBytes) {
            const bytesDelta = downloadedBytes - lastReportBytes
            const seconds = timeDelta / 1000
            const bytesPerSec = bytesDelta / Math.max(0.1, seconds)
            const mbPerSec = (bytesPerSec / (1024 * 1024)).toFixed(1)
            speedFormatted = `${mbPerSec} MB/s`

            lastReportTime = now
            lastReportBytes = downloadedBytes

            const pct =
              totalBytes > 0
                ? Math.min(99, Math.max(1, Math.round((downloadedBytes / totalBytes) * 100)))
                : 0

            onProgress?.({
              modelId,
              percentage: pct,
              downloaded: downloadedBytes,
              total: totalBytes,
              speed: speedFormatted,
            })
          }
        }
      }

      // Close and finalize stream
      await new Promise<void>((resolve, reject) => {
        if (!fileStream) return resolve()
        fileStream.on('finish', resolve)
        fileStream.on('error', reject)
        fileStream.end()
      })
      fileStream = null

      if (isCancelled) {
        throw new Error('Download cancelled')
      }

      // Verify downloaded file size and integrity
      const st = fs.statSync(tempPath)
      if (st.size < 1024 * 1024) {
        throw new Error(`Downloaded file size (${st.size} bytes) is too small. Corrupt or incomplete download.`)
      }

      // Verify GGUF header magic
      const fd = fs.openSync(tempPath, 'r')
      const headerBuf = Buffer.alloc(4)
      fs.readSync(fd, headerBuf, 0, 4, 0)
      fs.closeSync(fd)
      if (headerBuf.toString('ascii') !== 'GGUF') {
        throw new Error(`Downloaded file is not a valid GGUF binary (magic: ${headerBuf.toString('ascii')})`)
      }

      // Atomically move temp file to destination
      if (fs.existsSync(finalPath)) {
        try {
          fs.unlinkSync(finalPath)
        } catch {}
      }
      fs.renameSync(tempPath, finalPath)

      this.downloadedModelIds.add(modelId)
      this.syncCacheFromDisk()
      this.saveState()

      onProgress?.({
        modelId,
        percentage: 100,
        downloaded: totalBytes,
        total: totalBytes,
        speed: 'Completed',
      })

      return { success: true, modelId }
    } catch (err: any) {
      if (fileStream) {
        try {
          fileStream.destroy()
        } catch {}
      }
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath)
        } catch {}
      }
      this.downloadedModelIds.delete(modelId)
      this.saveState()

      const isAbort = isCancelled || err?.name === 'AbortError' || String(err).includes('cancelled')
      return {
        success: false,
        modelId,
        error: isAbort ? 'Download cancelled' : err?.message || String(err),
      }
    } finally {
      this.activeDownloads.delete(modelId)
    }
  }
}
