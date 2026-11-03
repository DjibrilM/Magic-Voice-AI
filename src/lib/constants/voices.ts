import { Voice } from '../interfaces/voice'
import {
  scanVoiceSamples,
  loadVoicesForLanguage,
  loadVoicesForPackage,
  loadAllVoices,
  getCachedVoices,
  isLanguageLoaded,
  subscribeToVoicePackages,
  type VoicePackageInfo,
} from '../services/voiceLoader'

export {
  scanVoiceSamples,
  loadVoicesForLanguage,
  loadVoicesForPackage,
  loadAllVoices,
  getCachedVoices,
  isLanguageLoaded,
  subscribeToVoicePackages,
  type VoicePackageInfo,
}

// Voices are queried dynamically from public/voices/samples/<folder>/json/voices.json
export const MULTILINGUAL_VOICES: Record<string, Voice[]> = {}

export const ALL_MULTILINGUAL_VOICES: Voice[] = []

export const INITIAL_VOICES: Voice[] = []

export const ALL_VOICES: Voice[] = []

export const PRESET_AVATARS = [
  { name: 'Sterling', url: '/voices/sterling.jpg' },
  { name: 'Serena', url: '/voices/serena.jpg' },
  { name: 'Chloe', url: '/voices/chloe.jpg' },
  { name: 'Jax', url: '/voices/jax.jpg' },
  { name: 'Alistair', url: '/voices/alistair.jpg' },
  { name: 'Dorian', url: '/voices/dorian.jpg' },
  { name: 'Rowan', url: '/voices/rowan.jpg' },
  { name: 'Kaelen', url: '/voices/kaelen.jpg' },
  { name: 'Leo', url: '/voices/leo.jpg' },
  { name: 'Eleanor', url: '/voices/eleanor.jpg' },
  { name: 'Helena', url: '/voices/helena.jpg' },
  { name: 'Milo', url: '/voices/milo.jpg' },
]

/**
 * Gets voices for a language from the dynamic cache.
 */
export function getVoicesForLanguage(langNameOrCode?: string): Voice[] {
  return getCachedVoices(langNameOrCode)
}
