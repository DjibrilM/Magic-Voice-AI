import { useState, useCallback, useEffect } from 'react'
import { getModelInfo as apiGetModelInfo } from '@/modules/text-to-speech/services/tts-service'

export interface ModelInfoResult {
  isCached: boolean
  isLoaded: boolean
  modelId: string
  expectedSize: number
  addon: string
  name: string
}

export interface UseModelInfoReturn {
  info: ModelInfoResult | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * React hook that checks whether a QVAC model is downloaded/cached
 * using @qvac/sdk getModelInfo (via IPC to the main process).
 *
 * @param qvacName - The QVAC catalog model name to look up.
 * @param autoCheck - Whether to automatically check on mount.
 */
export function useModelInfo(qvacName: string, autoCheck = true): UseModelInfoReturn {
  const [info, setInfo] = useState<ModelInfoResult | null>(null)
  const [isLoading, setIsLoading] = useState(autoCheck)
  const [error, setError] = useState<string | null>(null)

  const fetchInfo = useCallback(async () => {
    if (!qvacName) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiGetModelInfo(qvacName)
      if (res.success && res.data) {
        setInfo({
          name: qvacName,
          isCached: res.data.isCached,
          isLoaded: res.data.isLoaded,
          modelId: res.data.modelId,
          expectedSize: res.data.expectedSize,
          addon: res.data.addon,
        })
      } else {
        setError(res.error || 'Unknown error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [qvacName])

  useEffect(() => {
    if (autoCheck) {
      fetchInfo()
    }
  }, [fetchInfo, autoCheck])

  return { info, isLoading, error, refetch: fetchInfo }
}

export default useModelInfo