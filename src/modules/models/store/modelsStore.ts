import { useEffect, useCallback } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type {
  VoiceEngineType,
  VoiceModelInfo,
  VoiceModelStatusResult,
  ModelDownloadProgressPayload,
} from '../types'
import {
  getModelStatus as apiGetModelStatus,
  downloadModel as apiDownloadModel,
  cancelModelDownload as apiCancelModelDownload,
  deleteAllModels as apiDeleteAllModels,
  onModelDownloadProgress,
} from '../services/models-service'

export const defaultModels: VoiceModelInfo[] = [
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
    downloaded: false,
    status: 'idle',
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
    required: true,
    downloaded: false,
    status: 'idle',
  },
  {
    id: 'cosyvoice3-s3tok-fp16',
    name: 'CosyVoice 3 S3Tok Speech Tokenizer (FP16)',
    descriptorName: 'TTS_COSYVOICE3_S3TOK_COSYVOICE_FP16',
    sizeBytes: 496605536,
    sizeFormatted: '496 MB',
    description:
      'Speech tokenizer required for high-fidelity instant voice cloning in CosyVoice 3.',
    category: 'speech-tokenizer',
    engine: 'cosyvoice3',
    required: true,
    downloaded: false,
    status: 'idle',
  },
  {
    id: 'cosyvoice3-campplus-fp32',
    name: 'CosyVoice 3 CAM++ Speaker Encoder (FP32)',
    descriptorName: 'TTS_COSYVOICE3_CAMPPLUS_COSYVOICE_FP32',
    sizeBytes: 27530656,
    sizeFormatted: '27 MB',
    description:
      'Deep acoustic timbre and speaker embedding extractor for voice cloning in CosyVoice 3.',
    category: 'speaker-encoder',
    engine: 'cosyvoice3',
    required: true,
    downloaded: false,
    status: 'idle',
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
    downloaded: false,
    status: 'idle',
  },
]

// ============================================================================
// Jotai Atoms for Models Management
// ============================================================================

export const selectedVoiceEngineAtom = atomWithStorage<VoiceEngineType>(
  'echo_selected_voice_engine',
  'cosyvoice3'
)

export const modelsStatusAtom = atom<VoiceModelStatusResult | null>(null)
export const isCheckingModelsAtom = atom<boolean>(true)
export const downloadingModelsAtom = atom<Record<string, ModelDownloadProgressPayload>>({})

// Derived atom: resolved models list
export const modelsListAtom = atom<VoiceModelInfo[]>((get) => {
  const status = get(modelsStatusAtom)
  return status?.models && status.models.length > 0 ? status.models : defaultModels
})

// Derived atom: true ONLY when all 5 models are verified on disk and zero downloads are active
export const allRequiredModelsReadyAtom = atom<boolean>((get) => {
  const isChecking = get(isCheckingModelsAtom)
  if (isChecking) return false

  const downloading = get(downloadingModelsAtom)
  if (Object.keys(downloading).length > 0) return false

  const models = get(modelsListAtom)
  const activeModels = models.filter((m) => m.engine === 'cosyvoice3' || m.engine === 'shared')
  if (activeModels.length === 0) return false

  return activeModels.every((m) => m.downloaded && m.status !== 'downloading')
})

let lastCheckedEngine: VoiceEngineType | null = null
let activeProgressListeners = 0
let globalProgressUnsubscribe: (() => void) | null = null

// ============================================================================
// Hook: useModels
// ============================================================================

export function useModels() {
  const [selectedEngine, setSelectedEngine] = useAtom(selectedVoiceEngineAtom)
  const [modelsStatus, setModelsStatus] = useAtom(modelsStatusAtom)
  const [isChecking, setIsChecking] = useAtom(isCheckingModelsAtom)
  const [downloadingModels, setDownloadingModels] = useAtom(downloadingModelsAtom)
  const models = useAtomValue(modelsListAtom)
  const allRequiredReady = useAtomValue(allRequiredModelsReadyAtom)

  // Active models scoped to CosyVoice 3 and shared enhancers
  const activeEngineModels = models.filter(
    (model) => model.engine === 'cosyvoice3' || model.engine === 'shared'
  )

  // Required models for synthesis (all 5 active models)
  const requiredModels = activeEngineModels.filter(
    (model) => model.required || model.engine === 'cosyvoice3' || model.engine === 'shared'
  )

  const totalRequiredSizeBytes = requiredModels.reduce(
    (total, model) => total + model.sizeBytes,
    0
  )
  const totalSizeGb = (totalRequiredSizeBytes / (1024 * 1024 * 1024)).toFixed(1)

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const res = await apiGetModelStatus(selectedEngine)
      if (res && res.success && res.data) {
        setModelsStatus(res.data)
        return
      }
    } catch (err) {
      console.warn('[modelsStore] Failed to get model status via modelsService:', err)
    }

    const fallbackStatus: VoiceModelStatusResult = {
      ready: false,
      allRequiredDownloaded: false,
      models: defaultModels,
      cacheDirectory: '~/.qvac/models',
    }
    setModelsStatus(fallbackStatus)
  }, [selectedEngine, setModelsStatus])

  // Lifecycle status check once per engine change across all mounted hook instances
  useEffect(() => {
    if (lastCheckedEngine === selectedEngine && modelsStatus !== null) {
      return
    }
    lastCheckedEngine = selectedEngine
    let mounted = true

    const initCheck = async () => {
      setIsChecking(true)
      await refreshStatus()
      if (mounted) {
        setIsChecking(false)
      }
    }

    initCheck()

    return () => {
      mounted = false
    }
  }, [selectedEngine, modelsStatus, refreshStatus, setIsChecking])

  // Subscribe to live model download progress events (singleton subscription across hook instances)
  useEffect(() => {
    activeProgressListeners += 1

    if (!globalProgressUnsubscribe) {
      globalProgressUnsubscribe = onModelDownloadProgress((payload) => {
        if (!payload || !payload.modelId) return

        if (payload.percentage >= 100 && payload.speed === 'Completed') {
          // Refresh disk status FIRST before clearing downloadingModels[modelId]
          // so allRequiredModelsReadyAtom never transitions prematurely.
          refreshStatus().finally(() => {
            setDownloadingModels((prev) => {
              if (!prev[payload.modelId]) return prev
              const next = { ...prev }
              delete next[payload.modelId]
              return next
            })
          })
          return
        }

        setDownloadingModels((prev) => {
          const existing = prev[payload.modelId]
          const monotonicPct = existing
            ? Math.max(existing.percentage, payload.percentage)
            : payload.percentage
          const monotonicDownloaded = existing
            ? Math.max(existing.downloaded, payload.downloaded)
            : payload.downloaded

          return {
            ...prev,
            [payload.modelId]: {
              ...payload,
              percentage: monotonicPct,
              downloaded: monotonicDownloaded,
            },
          }
        })
      })
    }

    return () => {
      activeProgressListeners = Math.max(0, activeProgressListeners - 1)
      if (activeProgressListeners === 0 && globalProgressUnsubscribe) {
        globalProgressUnsubscribe()
        globalProgressUnsubscribe = null
      }
    }
  }, [refreshStatus, setDownloadingModels])

  const downloadModel = useCallback(
    async (modelId: string): Promise<boolean> => {
      setDownloadingModels((prev) => ({
        ...prev,
        [modelId]: prev[modelId] || {
          modelId,
          percentage: 0,
          downloaded: 0,
          total: 100,
          speed: 'Connecting...',
        },
      }))

      try {
        const res = await apiDownloadModel({ modelId, engine: selectedEngine })
        if (res && res.success) {
          if (res.data) setModelsStatus(res.data as VoiceModelStatusResult)
          else await refreshStatus()
          return true
        } else {
          console.error(`[modelsStore] Download failed for ${modelId}:`, res?.error)
          if (res?.data) setModelsStatus(res.data as VoiceModelStatusResult)
          else await refreshStatus()
          return false
        }
      } catch (err) {
        console.error(`[modelsStore] Download error for ${modelId}:`, err)
        await refreshStatus()
        return false
      } finally {
        setDownloadingModels((prev) => {
          if (!prev[modelId]) return prev
          const next = { ...prev }
          delete next[modelId]
          return next
        })
      }
    },
    [selectedEngine, refreshStatus, setDownloadingModels, setModelsStatus]
  )

  const downloadAllRequired = useCallback(async (): Promise<boolean> => {
    const needed = requiredModels.filter((m) => !m.downloaded)
    if (needed.length === 0) {
      await refreshStatus()
      return true
    }

    const results = await Promise.all(needed.map((model) => downloadModel(model.id)))
    await refreshStatus()
    return results.every(Boolean)
  }, [requiredModels, downloadModel, refreshStatus])

  const cancelDownload = useCallback(
    async (modelId: string): Promise<boolean> => {
      try {
        await apiCancelModelDownload(modelId)
      } catch (err) {
        console.error(`[modelsStore] Cancel download error:`, err)
      }

      setDownloadingModels((prev) => {
        const next = { ...prev }
        delete next[modelId]
        return next
      })
      await refreshStatus()
      return true
    },
    [refreshStatus, setDownloadingModels]
  )

  const deleteAllModels = useCallback(async (): Promise<boolean> => {
    try {
      const res = await apiDeleteAllModels()
      if (res.success) {
        setDownloadingModels({})
        await refreshStatus()
        return true
      } else {
        console.error(`[modelsStore] Delete all models failed:`, res?.error)
        return false
      }
    } catch (err) {
      console.error(`[modelsStore] Delete all models error:`, err)
      return false
    }
  }, [refreshStatus, setDownloadingModels])

  return {
    selectedEngine,
    setSelectedEngine,
    modelsStatus,
    models,
    activeEngineModels,
    requiredModels,
    totalSizeGb,
    allRequiredReady,
    isChecking,
    downloadingModels,
    downloadModel,
    downloadAllRequired,
    cancelDownload,
    deleteAllModels,
    refreshStatus,
  }
}
