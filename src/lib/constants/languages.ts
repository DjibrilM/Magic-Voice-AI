import { LanguageOption } from '../interfaces/model'
import {
  scanVoiceSamples,
  getDynamicLanguages,
  useDynamicLanguages,
  subscribeToLanguages,
  packagesToLanguageOptions,
  DYNAMIC_LANGUAGES_REF,
} from '../services/voiceLoader'

export {
  scanVoiceSamples,
  getDynamicLanguages,
  useDynamicLanguages,
  subscribeToLanguages,
  packagesToLanguageOptions,
}

export const AUTO_LANGUAGE: LanguageOption = {
  code: 'auto',
  name: 'Auto Detect',
  nativeName: 'Automatic detection',
  isAuto: true,
}

export const DEFAULT_LANGUAGE = 'English (US)'

/**
 * Dynamically queried languages array.
 * Populated at runtime by scanning the voices/samples directory and reading each folder's info.json header file.
 */
export const LANGUAGES: LanguageOption[] = DYNAMIC_LANGUAGES_REF
