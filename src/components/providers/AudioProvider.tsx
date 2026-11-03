import React, { useEffect } from 'react'
import { getDefaultStore } from 'jotai'
import {
  currentTimeAtom,
  durationAtom,
  volumeAtom,
  isMutedAtom,
  isPlayingAtom,
} from '@/store/playerStore'

// ============================================================================
// Real-time Event Listener Registries for Central Audio Element
// Architecture follows IpcProvider pattern: Map-based registry for zero-overhead
// ============================================================================

export const audioTimeListeners = new Map<string, (time: number, duration: number) => void>()
export const audioStateListeners = new Map<string, (isPlaying: boolean, isBuffering: boolean) => void>()
export const audioVolumeListeners = new Map<string, (volume: number, isMuted: boolean) => void>()
export const audioTrackEndedListeners = new Map<string, () => void>()

// ============================================================================
// Central Single Audio Instance (using new Audio(), not a rendered HTML element)
// ============================================================================

let centralAudioInstance: HTMLAudioElement | null = null

function broadcastTime(time: number, rawDuration: number) {
  // Streamed WAV over a custom protocol can report Infinity/NaN; never leak that
  const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0
  // Sync directly to global Jotai atoms so all components can reach out to them
  try {
    const store = getDefaultStore()
    store.set(currentTimeAtom, time)
    if (Number.isFinite(duration) && duration > 0) {
      store.set(durationAtom, duration)
    }
  } catch {}

  audioTimeListeners.forEach((cb) => {
    try {
      cb(time, duration)
    } catch (e) {
      console.warn('Error in audioTimeListener:', e)
    }
  })
}

function broadcastState(isPlaying: boolean, isBuffering: boolean) {
  try {
    const store = getDefaultStore()
    store.set(isPlayingAtom, isPlaying)
  } catch {}

  audioStateListeners.forEach((cb) => {
    try {
      cb(isPlaying, isBuffering)
    } catch (e) {
      console.warn('Error in audioStateListener:', e)
    }
  })
}

function broadcastVolume(volume: number, isMuted: boolean) {
  try {
    const store = getDefaultStore()
    store.set(volumeAtom, volume)
    store.set(isMutedAtom, isMuted)
  } catch {}

  audioVolumeListeners.forEach((cb) => {
    try {
      cb(volume, isMuted)
    } catch (e) {
      console.warn('Error in audioVolumeListener:', e)
    }
  })
}

function initCentralAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (centralAudioInstance) return centralAudioInstance

  const audio = new Audio()
  audio.preload = 'auto'

  // Restore saved volume or default to 0.85
  try {
    const saved = localStorage.getItem('echo_player_volume')
    if (saved !== null) {
      const parsed = parseFloat(saved)
      audio.volume = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.85
    } else {
      audio.volume = 0.85
    }
  } catch {
    audio.volume = 0.85
  }

  try {
    const savedMuted = localStorage.getItem('echo_player_muted')
    if (savedMuted !== null) {
      audio.muted = savedMuted === 'true'
    }
  } catch {}

  const handleTime = () => {
    broadcastTime(audio.currentTime, audio.duration || 0)
  }

  const handlePlay = () => {
    broadcastState(true, false)
  }

  const handlePause = () => {
    handleTime()
    broadcastState(false, false)
  }

  const handleWaiting = () => {
    broadcastState(!audio.paused, true)
  }

  const handlePlaying = () => {
    broadcastState(true, false)
  }

  const handleEnded = () => {
    handleTime()
    broadcastState(false, false)
    audioTrackEndedListeners.forEach((cb) => {
      try {
        cb()
      } catch (e) {
        console.warn('Error in audioTrackEndedListener:', e)
      }
    })
  }

  const handleVolume = () => {
    broadcastVolume(audio.volume, audio.muted)
    try {
      localStorage.setItem('echo_player_volume', String(audio.volume))
      localStorage.setItem('echo_player_muted', String(audio.muted))
    } catch {}
  }

  const handleError = (e: Event) => {
    console.warn('Central audio element error:', e)
    broadcastState(false, false)
  }

  audio.addEventListener('timeupdate', handleTime)
  audio.addEventListener('seeking', handleTime)
  audio.addEventListener('seeked', handleTime)
  audio.addEventListener('durationchange', handleTime)
  audio.addEventListener('loadedmetadata', handleTime)
  audio.addEventListener('play', handlePlay)
  audio.addEventListener('playing', handlePlaying)
  audio.addEventListener('pause', handlePause)
  audio.addEventListener('waiting', handleWaiting)
  audio.addEventListener('ended', handleEnded)
  audio.addEventListener('volumechange', handleVolume)
  audio.addEventListener('error', handleError)

  centralAudioInstance = audio
  return audio
}

export function getCentralAudioElement(): HTMLAudioElement | null {
  return initCentralAudio()
}

export function getCentralAudioCurrentTime(): number {
  const el = getCentralAudioElement()
  return el ? el.currentTime : 0
}

export function getCentralAudioDuration(): number {
  const el = getCentralAudioElement()
  return el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0
}

export function getCentralAudioVolume(): number {
  const el = getCentralAudioElement()
  return el ? el.volume : 0.85
}

export function getCentralAudioIsMuted(): boolean {
  const el = getCentralAudioElement()
  return el ? el.muted : false
}

export function getCentralAudioIsPlaying(): boolean {
  const el = getCentralAudioElement()
  return el ? !el.paused : false
}

// ============================================================================
// Outbound Central Audio Actions
// ============================================================================

/**
 * Changes source of the central audio element and starts playback on load
 */
export async function centralAudioPlaySource(url?: string, startTime = 0): Promise<void> {
  const el = getCentralAudioElement()
  if (!el) return

  if (!url || !url.trim()) {
    el.pause()
    el.removeAttribute('src')
    broadcastState(false, false)
    broadcastTime(0, 0)
    return
  }

  const cleanUrl = url.trim()
  const currentSrc = el.currentSrc || el.src

  // If already loaded and same source, simply seek and play
  const isSame =
    currentSrc === cleanUrl ||
    currentSrc.endsWith(encodeURI(cleanUrl)) ||
    currentSrc.endsWith(cleanUrl)

  if (isSame && el.readyState >= HTMLMediaElement.HAVE_METADATA) {
    if (Number.isFinite(startTime) && startTime > 0) {
      el.currentTime = startTime
    }
    return el.play().catch((err) => {
      console.warn('Central audio play error:', err)
      broadcastState(false, false)
    })
  }

  // New source: pause, change source, and start on load!
  el.pause()
  el.src = cleanUrl
  el.load()

  return new Promise<void>((resolve) => {
    let handled = false

    const onCanPlay = async () => {
      if (handled) return
      handled = true
      cleanup()

      try {
        if (Number.isFinite(startTime) && startTime > 0) {
          el.currentTime = startTime
        }
        await el.play()
        broadcastState(true, false)
        resolve()
      } catch (err) {
        console.warn('Central audio play error on load:', err)
        broadcastState(false, false)
        resolve()
      }
    }

    const onError = () => {
      if (handled) return
      handled = true
      cleanup()
      console.warn('Central audio error loading source:', cleanUrl)
      broadcastState(false, false)
      resolve()
    }

    const cleanup = () => {
      el.removeEventListener('canplay', onCanPlay)
      el.removeEventListener('error', onError)
    }

    el.addEventListener('canplay', onCanPlay, { once: true })
    el.addEventListener('error', onError, { once: true })
  })
}

/**
 * Seeks the central audio element directly and broadcasts immediately
 */
export function centralAudioSeek(seconds: number) {
  const el = getCentralAudioElement()
  if (!el || !Number.isFinite(seconds)) return
  let safeTime = Math.max(0, seconds)
  // Never seek to/past the real end: that fires 'ended' and pauses playback
  if (Number.isFinite(el.duration) && el.duration > 0) {
    safeTime = Math.min(safeTime, Math.max(0, el.duration - 0.25))
  }
  el.currentTime = safeTime
  broadcastTime(safeTime, Number.isFinite(el.duration) ? el.duration : 0)
}

/**
 * Sets volume on the central audio element and broadcasts immediately
 */
export function centralAudioSetVolume(volume: number) {
  const el = getCentralAudioElement()
  if (!el) return
  const safeVol = Math.max(0, Math.min(1, volume))
  el.volume = safeVol
  if (safeVol > 0 && el.muted) {
    el.muted = false
  }
  broadcastVolume(safeVol, el.muted)
  try {
    localStorage.setItem('echo_player_volume', String(safeVol))
    localStorage.setItem('echo_player_muted', String(el.muted))
  } catch {}
}

/**
 * Toggles mute on the central audio element and broadcasts immediately
 */
export function centralAudioToggleMute() {
  const el = getCentralAudioElement()
  if (!el) return
  el.muted = !el.muted
  broadcastVolume(el.volume, el.muted)
  try {
    localStorage.setItem('echo_player_muted', String(el.muted))
  } catch {}
}

/**
 * Toggles playback on the central audio element
 */
export function centralAudioTogglePlay() {
  const el = getCentralAudioElement()
  if (!el) return
  if (el.paused) {
    el.play().catch((err) => console.warn('Play error:', err))
  } else {
    el.pause()
  }
}

export function centralAudioPause() {
  getCentralAudioElement()?.pause()
}

export function centralAudioResume() {
  getCentralAudioElement()?.play().catch((err) => console.warn('Resume error:', err))
}

// ============================================================================
// AudioProvider Root Component
// Acts as central context boundary mirroring IpcProvider (no rendered HTML audio tag)
// ============================================================================

export interface AudioProviderProps {
  children: React.ReactNode
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  useEffect(() => {
    const el = initCentralAudio()
    if (el) {
      broadcastVolume(el.volume, el.muted)
      broadcastState(!el.paused, false)
      broadcastTime(el.currentTime, el.duration || 0)
    }
  }, [])

  return <>{children}</>
}

export default AudioProvider
