import { atom, useAtom } from 'jotai'
import {
  useModels,
  modelsStatusAtom,
  isCheckingModelsAtom,
  downloadingModelsAtom,
  modelsListAtom,
  allRequiredModelsReadyAtom,
} from '@/modules/models'

export type {
  VoiceModelInfo,
  VoiceModelStatusResult,
  ModelDownloadProgressPayload,
  VoiceEngineType,
  ModelDownloadOptions,
} from '@/modules/models'

export {
  defaultModels,
  useModels,
  selectedVoiceEngineAtom,
  modelsStatusAtom,
  isCheckingModelsAtom,
  downloadingModelsAtom,
  modelsListAtom,
  allRequiredModelsReadyAtom,
} from '@/modules/models'


export const voiceEngineIsModalOpenAtom = atom<boolean>(false)
export const shatterBoxIsModalOpenAtom = voiceEngineIsModalOpenAtom

// Aliases for backward compatibility
export const voiceEngineModelsStatusAtom = modelsStatusAtom
export const voiceEngineIsCheckingAtom = isCheckingModelsAtom
export const voiceEngineDownloadingModelsAtom = downloadingModelsAtom
export const voiceEngineModelsAtom = modelsListAtom
export const voiceEngineAllRequiredReadyAtom = allRequiredModelsReadyAtom

export const shatterBoxModelsStatusAtom = modelsStatusAtom
export const shatterBoxIsCheckingAtom = isCheckingModelsAtom
export const shatterBoxDownloadingModelsAtom = downloadingModelsAtom
export const shatterBoxModelsAtom = modelsListAtom
export const shatterBoxAllRequiredReadyAtom = allRequiredModelsReadyAtom

export function useVoiceEngineModels() {
  const modelsHook = useModels()
  const [isModalOpen, setIsModalOpen] = useAtom(voiceEngineIsModalOpenAtom)

  return {
    ...modelsHook,
    isModalOpen,
    setIsModalOpen,
    markAllReady: modelsHook.refreshStatus,
  }
}

export const useShatterBoxModels = useVoiceEngineModels
