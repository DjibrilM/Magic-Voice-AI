import { useState, useEffect } from 'react'
import { Voice } from '../interfaces/voice'
import { LanguageOption } from '../interfaces/model'

export interface VoicePackageInfo {
  folder: string
  language: string
  name: string
  flag: string
  code: string
  nativeName?: string
  list: string
  location: string
  listUrl: string
  count?: number
}

export interface VoiceRawItem {
  id: string
  audio: string
  image: string
  color: string
  info: {
    id?: string
    name?: string
    description?: string
    gender?: 'Female' | 'Male' | 'Neutral'
    tags?: string[]
    category?: 'preset' | 'cloned'
    initials?: string
    languageCode?: string
    languageName?: string
  }
  name?: string
  description?: string
  avatarUrl?: string
  sampleUrl?: string
  gender?: 'Female' | 'Male' | 'Neutral'
  tags?: string[]
  initials?: string
  category?: 'preset' | 'cloned'
  languageCode?: string
  languageName?: string
}

// In-memory cache of scanned packages and loaded voices
let cachedPackages: VoicePackageInfo[] | null = null
let scanInFlight: Promise<VoicePackageInfo[]> | null = null
const voicesCacheByFolder = new Map<string, Voice[]>()
const inFlightVoiceLoads = new Map<string, Promise<Voice[]>>()

const AUTO_LANGUAGE: LanguageOption = {
  code: 'auto',
  name: 'Auto Detect',
  nativeName: 'Automatic detection',
  isAuto: true,
}

let dynamicLanguagesList: LanguageOption[] = [AUTO_LANGUAGE]
const packageListeners = new Set<(packages: VoicePackageInfo[]) => void>()
const languageListeners = new Set<(languages: LanguageOption[]) => void>()

// Direct mutable reference exported for legacy array access
export const DYNAMIC_LANGUAGES_REF: LanguageOption[] = [AUTO_LANGUAGE]

/**
 * Normalizes a raw voice item (from json/voices.json) into a typed Voice object
 * preserving both `{ audio, image, color, info }` and the standard Voice interface.
 */
export function normalizeVoiceItem(raw: VoiceRawItem, folder: string, pkg?: VoicePackageInfo): Voice {
  const info = raw.info || {}
  const id = raw.id || info.id || `voice-${folder}-${Date.now()}`
  const name = raw.name || info.name || 'Unnamed Voice'
  const description = raw.description || info.description || ''
  const color = raw.color || '#38bdf8'
  const category = (raw.category || info.category || 'preset') as 'preset' | 'cloned'
  const gender = (raw.gender || info.gender || 'Neutral') as 'Female' | 'Male' | 'Neutral'
  const initials = raw.initials || info.initials || name.slice(0, 2).toUpperCase()
  const languageCode = raw.languageCode || info.languageCode || pkg?.code || folder
  const languageName = raw.languageName || info.languageName || pkg?.language || folder

  // Audio path resolution: if relative (e.g. "voice_en_male_1.mp3"), prepend folder sample path
  const rawAudio = raw.audio || raw.sampleUrl || ''
  const sampleUrl =
    rawAudio.startsWith('http') || rawAudio.startsWith('/')
      ? rawAudio
      : `/voices/samples/${folder}/${rawAudio}`

  // Image path resolution
  const rawImage = raw.image || raw.avatarUrl || '/voices/sterling.jpg'
  const avatarUrl =
    rawImage.startsWith('http') || rawImage.startsWith('/')
      ? rawImage
      : `/voices/${rawImage}`

  const tags = raw.tags || info.tags || [languageName, gender]

  return {
    id,
    name,
    description,
    category,
    color,
    avatarUrl,
    sampleUrl,
    initials,
    gender,
    tags,
    languageCode,
    languageName,
    // Keep raw audio/image/info accessible on the object for custom handlers
    ...({
      audio: sampleUrl,
      image: avatarUrl,
      info: {
        id,
        name,
        description,
        gender,
        tags,
        category,
        initials,
        languageCode,
        languageName,
      },
    } as Record<string, unknown>),
  }
}

/**
 * Converts a list of packages to LanguageOption objects.
 */
export function packagesToLanguageOptions(packages: VoicePackageInfo[]): LanguageOption[] {
  const dynamicOptions: LanguageOption[] = packages.map((pkg) => ({
    code: pkg.code,
    name: pkg.name || pkg.language,
    nativeName: pkg.nativeName || pkg.name || pkg.language,
    flag: pkg.flag,
  }))

  return [AUTO_LANGUAGE, ...dynamicOptions]
}

function updateDynamicLanguages(packages: VoicePackageInfo[]) {
  dynamicLanguagesList = packagesToLanguageOptions(packages)
  // Mutate DYNAMIC_LANGUAGES_REF in-place
  DYNAMIC_LANGUAGES_REF.splice(0, DYNAMIC_LANGUAGES_REF.length, ...dynamicLanguagesList)
  languageListeners.forEach((fn) => {
    try {
      fn(dynamicLanguagesList)
    } catch {
      // ignore
    }
  })
}

/**
 * Dynamically analyzes the public/voices/samples folder, discovers all folders,
 * and reads the header file info.json from each self-contained folder.
 * Deduplicates in-flight calls so multiple callers share a single scan.
 */
export async function scanVoiceSamples(): Promise<VoicePackageInfo[]> {
  if (cachedPackages && cachedPackages.length > 0) {
    return cachedPackages
  }

  if (scanInFlight) {
    return scanInFlight
  }

  scanInFlight = (async () => {
    // 1. Attempt Electron IPC scanning if running in desktop environment
    try {
      const ipc = (window as unknown as { ipcRenderer?: { invoke: (channel: string) => Promise<{ success: boolean; packages?: VoicePackageInfo[] }> } }).ipcRenderer
      if (ipc?.invoke) {
        const res = await ipc.invoke('scan-voice-samples')
        if (res?.success && Array.isArray(res.packages) && res.packages.length > 0) {
          cachedPackages = res.packages
          updateDynamicLanguages(cachedPackages)
          notifyPackageListeners()
          return cachedPackages
        }
      }
    } catch (err) {
      console.debug('[voiceLoader] Electron IPC scan not available or failed:', err)
    }

    // 2. Web fallback: fetch the samples index.json
    try {
      const res = await fetch('/voices/samples/index.json')
      if (res.ok) {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('json') || contentType.includes('text')) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            cachedPackages = data
            updateDynamicLanguages(cachedPackages)
            notifyPackageListeners()
            return cachedPackages
          }
        }
      }
    } catch (err) {
      console.debug('[voiceLoader] Failed to fetch /voices/samples/index.json:', err)
    }

    // 3. Fallback: probe known folders for info.json
    const probeFolders = [
      'en', 'en-gb', 'en-au', 'en-af', 'es', 'fr', 'de', 'it',
      'pt', 'ja', 'zh', 'ko', 'hi', 'ar', 'ru', 'sw'
    ]

    const discovered: VoicePackageInfo[] = []
    await Promise.allSettled(
      probeFolders.map(async (folder) => {
        try {
          const infoRes = await fetch(`/voices/samples/${folder}/info.json`)
          if (infoRes.ok) {
            const header = await infoRes.json()
            discovered.push({
              folder,
              language: header.language || folder,
              name: header.name || header.language || folder,
              flag: header.flag || '🌐',
              code: header.code || folder,
              nativeName: header.nativeName || header.name || header.language,
              list: header.list || 'json/voices.json',
              location: header.location || header.list || 'json/voices.json',
              listUrl: `/voices/samples/${folder}/${(header.list || 'json/voices.json').replace(/^\//, '')}`,
              count: header.count || 0,
            })
          }
        } catch {
          // ignore
        }
      })
    )

    if (discovered.length > 0) {
      cachedPackages = discovered
      updateDynamicLanguages(cachedPackages)
      notifyPackageListeners()
      return cachedPackages
    }

    return []
  })().finally(() => {
    scanInFlight = null
  })

  return scanInFlight
}

/**
 * Returns current dynamic languages list synchronously.
 */
export function getDynamicLanguages(): LanguageOption[] {
  return dynamicLanguagesList
}

/**
 * React hook that returns dynamic languages and updates whenever folders are scanned.
 */
export function useDynamicLanguages(): LanguageOption[] {
  const [languages, setLanguages] = useState<LanguageOption[]>(dynamicLanguagesList)

  useEffect(() => {
    if (!cachedPackages) {
      scanVoiceSamples().then((pkgs) => {
        if (pkgs.length > 0) {
          setLanguages(packagesToLanguageOptions(pkgs))
        }
      })
    }

    const unsubscribe = subscribeToLanguages((next) => {
      setLanguages(next)
    })
    return unsubscribe
  }, [])

  return languages
}

/**
 * Dynamically loads all voices for a specific language or package folder.
 * Reads the voice list from the folder's json/ directory (e.g. /voices/samples/en/json/voices.json).
 * Deduplicates in-flight loads to prevent duplicate network calls.
 */
export async function loadVoicesForPackage(pkgOrFolder: VoicePackageInfo | string): Promise<Voice[]> {
  let pkg: VoicePackageInfo | undefined

  if (typeof pkgOrFolder === 'string') {
    const packages = await scanVoiceSamples()
    const query = pkgOrFolder.toLowerCase()
    pkg = packages.find(
      (p) =>
        p.folder.toLowerCase() === query ||
        p.code.toLowerCase() === query ||
        p.language.toLowerCase() === query ||
        p.name.toLowerCase() === query
    )
    if (!pkg) {
      pkg = {
        folder: pkgOrFolder,
        code: pkgOrFolder,
        language: pkgOrFolder,
        name: pkgOrFolder,
        flag: '🌐',
        list: 'json/voices.json',
        location: 'json/voices.json',
        listUrl: `/voices/samples/${pkgOrFolder}/json/voices.json`,
      }
    }
  } else {
    pkg = pkgOrFolder
  }

  const cacheKey = pkg.folder || pkg.code
  if (voicesCacheByFolder.has(cacheKey)) {
    return voicesCacheByFolder.get(cacheKey)!
  }

  if (inFlightVoiceLoads.has(cacheKey)) {
    return inFlightVoiceLoads.get(cacheKey)!
  }

  const loadPromise = (async () => {
    const candidateUrls = [
      pkg!.listUrl,
      `/voices/samples/${pkg!.folder}/json/voices.json`,
      `/voices/samples/${pkg!.folder}/json/${pkg!.code}.json`,
      `/voices/samples/${pkg!.folder}/voices.json`,
    ]

    let loadedVoices: Voice[] = []
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url)
        if (res.ok) {
          const contentType = res.headers.get('content-type') || ''
          // Avoid HTML fallback from Vite SPA
          if (!contentType.includes('text/html')) {
            const rawList = await res.json()
            if (Array.isArray(rawList) && rawList.length > 0) {
              loadedVoices = rawList.map((item) => normalizeVoiceItem(item, pkg!.folder, pkg))
              break
            }
          }
        }
      } catch {
        // try next candidate
      }
    }

    if (loadedVoices.length > 0) {
      voicesCacheByFolder.set(cacheKey, loadedVoices)
      return loadedVoices
    }

    return []
  })().finally(() => {
    inFlightVoiceLoads.delete(cacheKey)
  })

  inFlightVoiceLoads.set(cacheKey, loadPromise)
  return loadPromise
}

/**
 * Dynamically loads voices for a language code or name (e.g. "en", "es", "Spanish", "English (UK)")
 */
export async function loadVoicesForLanguage(langNameOrCode?: string): Promise<Voice[]> {
  if (!langNameOrCode || langNameOrCode === 'auto' || langNameOrCode === 'Auto Detect') {
    return loadAllVoices()
  }

  const packages = await scanVoiceSamples()
  const norm = langNameOrCode.toLowerCase()
  const matched = packages.find(
    (p) =>
      p.code.toLowerCase() === norm ||
      p.language.toLowerCase() === norm ||
      p.name.toLowerCase() === norm ||
      p.folder.toLowerCase() === norm
  )

  if (matched) {
    return loadVoicesForPackage(matched)
  }

  return loadVoicesForPackage(langNameOrCode)
}

/**
 * Dynamically loads voices for all discovered language packages in parallel.
 */
export async function loadAllVoices(): Promise<Voice[]> {
  const packages = await scanVoiceSamples()
  const results = await Promise.all(
    packages.map((pkg) => loadVoicesForPackage(pkg).catch(() => []))
  )
  return results.flat()
}

/**
 * Synchronous getter for voices already cached in memory.
 */
export function getCachedVoices(langNameOrCode?: string): Voice[] {
  if (!langNameOrCode || langNameOrCode === 'all' || langNameOrCode === 'Auto Detect' || langNameOrCode === 'auto') {
    return Array.from(voicesCacheByFolder.values()).flat()
  }

  const norm = langNameOrCode.toLowerCase()
  for (const [key, voices] of voicesCacheByFolder.entries()) {
    if (
      key.toLowerCase() === norm ||
      voices[0]?.languageCode?.toLowerCase() === norm ||
      voices[0]?.languageName?.toLowerCase() === norm
    ) {
      return voices
    }
  }

  return []
}

/**
 * Returns true if voices for this language have already been fetched and cached.
 */
export function isLanguageLoaded(langNameOrCode: string): boolean {
  return getCachedVoices(langNameOrCode).length > 0
}

/**
 * Subscribe to package changes (e.g. when new voice folders are detected or scanned).
 */
export function subscribeToVoicePackages(listener: (packages: VoicePackageInfo[]) => void): () => void {
  packageListeners.add(listener)
  if (cachedPackages) {
    listener(cachedPackages)
  }
  return () => packageListeners.delete(listener)
}

/**
 * Subscribe to language list changes.
 */
export function subscribeToLanguages(listener: (languages: LanguageOption[]) => void): () => void {
  languageListeners.add(listener)
  return () => languageListeners.delete(listener)
}

function notifyPackageListeners() {
  if (cachedPackages) {
    packageListeners.forEach((fn) => {
      try {
        fn(cachedPackages!)
      } catch {
        // ignore
      }
    })
  }
}

/**
 * Saves a custom voice audio sample (imported or recorded) and returns
 * the local preview sampleUrl and disk filePath.
 */
export async function saveCustomVoice(payload: {
  voiceId: string
  name: string
  audioBuffer: ArrayBuffer | Uint8Array
  fileName?: string
  avatarBuffer?: ArrayBuffer | Uint8Array
  avatarFileName?: string
}): Promise<{ success: boolean; filePath?: string; sampleUrl?: string; avatarUrl?: string; error?: string }> {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    try {
      const res = await window.ipcRenderer.invoke('voices:save-custom', payload)
      return res
    } catch (err) {
      console.error('[voiceLoader] saveCustomVoice failed:', err)
      return { success: false, error: String(err) }
    }
  }
  return { success: false, error: 'IPC renderer unavailable' }
}

/**
 * Deletes a custom voice from disk
 */
export async function deleteCustomVoice(voiceId: string): Promise<{ success: boolean; error?: string }> {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    try {
      const res = await window.ipcRenderer.invoke('voices:delete-custom', { voiceId })
      return res
    } catch (err) {
      console.error('[voiceLoader] deleteCustomVoice failed:', err)
      return { success: false, error: String(err) }
    }
  }
  return { success: false, error: 'IPC renderer unavailable' }
}

