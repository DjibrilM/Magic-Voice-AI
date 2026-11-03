import { useEffect, useRef, useState } from 'react'
import {
  audioTimeListeners,
  audioStateListeners,
  audioVolumeListeners,
  audioTrackEndedListeners,
  getCentralAudioCurrentTime,
  getCentralAudioDuration,
  getCentralAudioVolume,
  getCentralAudioIsMuted,
  getCentralAudioIsPlaying,
  centralAudioSetVolume,
  centralAudioToggleMute,
  centralAudioSeek,
  centralAudioTogglePlay,
  centralAudioPlaySource,
  centralAudioPause,
  centralAudioResume,
} from '@/components/providers/AudioProvider'

export interface UseAudioEffectOptions {
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onStateChange?: (isPlaying: boolean, isBuffering: boolean) => void
  onVolumeChange?: (volume: number, isMuted: boolean) => void
  onTrackEnded?: () => void
}

/**
 * React hook to register real-time listeners for the centralized root audio element.
 * Architecture directly mirrors useIpcEffect with automatic listener cleanup and immediate state hydration.
 */
export const useAudioEffect = ({
  onTimeUpdate,
  onStateChange,
  onVolumeChange,
  onTrackEnded,
}: UseAudioEffectOptions) => {
  const callbacksRef = useRef<UseAudioEffectOptions>({
    onTimeUpdate,
    onStateChange,
    onVolumeChange,
    onTrackEnded,
  })

  // Always keep callbacks up to date to avoid stale closures
  callbacksRef.current = {
    onTimeUpdate,
    onStateChange,
    onVolumeChange,
    onTrackEnded,
  }

  const listenerId = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `audio-listener-${Date.now()}-${Math.random()}`
  )

  useEffect(() => {
    const id = listenerId.current

    if (onTimeUpdate) {
      audioTimeListeners.set(id, (time, dur) => {
        callbacksRef.current.onTimeUpdate?.(time, dur)
      })
      // Immediately notify current time and duration so subscriber is never idle
      callbacksRef.current.onTimeUpdate?.(getCentralAudioCurrentTime(), getCentralAudioDuration())
    }

    if (onStateChange) {
      audioStateListeners.set(id, (isPlaying, isBuffering) => {
        callbacksRef.current.onStateChange?.(isPlaying, isBuffering)
      })
      callbacksRef.current.onStateChange?.(getCentralAudioIsPlaying(), false)
    }

    if (onVolumeChange) {
      audioVolumeListeners.set(id, (volume, isMuted) => {
        callbacksRef.current.onVolumeChange?.(volume, isMuted)
      })
      // Immediately notify current volume and mute state
      callbacksRef.current.onVolumeChange?.(getCentralAudioVolume(), getCentralAudioIsMuted())
    }

    if (onTrackEnded) {
      audioTrackEndedListeners.set(id, () => {
        callbacksRef.current.onTrackEnded?.()
      })
    }

    return () => {
      audioTimeListeners.delete(id)
      audioStateListeners.delete(id)
      audioVolumeListeners.delete(id)
      audioTrackEndedListeners.delete(id)
    }
  }, [
    Boolean(onTimeUpdate),
    Boolean(onStateChange),
    Boolean(onVolumeChange),
    Boolean(onTrackEnded),
  ])
}

/**
 * Hook providing reactive state and actions directly synced to the central new Audio() element.
 */
export function useAudioState() {
  const [volume, setVolumeState] = useState(() => getCentralAudioVolume())
  const [isMuted, setIsMutedState] = useState(() => getCentralAudioIsMuted())
  const [currentTime, setCurrentTime] = useState(() => getCentralAudioCurrentTime())
  const [duration, setDuration] = useState(() => getCentralAudioDuration())
  const [isPlaying, setIsPlaying] = useState(() => getCentralAudioIsPlaying())

  useAudioEffect({
    onVolumeChange: (vol, muted) => {
      setVolumeState(vol)
      setIsMutedState(muted)
    },
    onTimeUpdate: (time, dur) => {
      setCurrentTime(time)
      if (dur > 0) setDuration(dur)
    },
    onStateChange: (playing) => {
      setIsPlaying(playing)
    },
  })

  return {
    volume,
    isMuted,
    currentTime,
    duration,
    isPlaying,
    setVolume: centralAudioSetVolume,
    toggleMute: centralAudioToggleMute,
    seek: centralAudioSeek,
    togglePlay: centralAudioTogglePlay,
    playSource: centralAudioPlaySource,
    pause: centralAudioPause,
    resume: centralAudioResume,
  }
}

export default useAudioEffect
