import { useState, useRef, useEffect, useCallback } from 'react'
import { Voice } from '../types'

export interface UseVoicePreviewReturn {
  playingVoiceId: string | null
  togglePreview: (voice: Voice, e?: React.MouseEvent) => void
  stopPreview: () => void
}

export function useVoicePreview(): UseVoicePreviewReturn {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayingVoiceId(null)
  }, [])

  const togglePreview = useCallback(
    (voice: Voice, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation()
        e.preventDefault()
      }

      if (playingVoiceId === voice.id) {
        stopPreview()
        return
      }

      stopPreview()

      if (!voice.sampleUrl) {
        return
      }

      try {
        const audio = new Audio(voice.sampleUrl)
        audioRef.current = audio
        setPlayingVoiceId(voice.id)

        audio.onended = () => {
          setPlayingVoiceId(null)
          audioRef.current = null
        }

        audio.onerror = (err) => {
          console.warn('Voice preview error:', err)
          setPlayingVoiceId(null)
          audioRef.current = null
        }

        audio.play().catch((err) => {
          console.warn('Voice preview play prevented:', err)
          setPlayingVoiceId(null)
          audioRef.current = null
        })
      } catch (err) {
        console.warn('Audio initialization error:', err)
        setPlayingVoiceId(null)
      }
    },
    [playingVoiceId, stopPreview]
  )

  useEffect(() => {
    return () => {
      stopPreview()
    }
  }, [stopPreview])

  return {
    playingVoiceId,
    togglePreview,
    stopPreview,
  }
}
