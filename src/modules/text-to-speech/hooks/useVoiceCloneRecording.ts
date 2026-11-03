import { useRef, useEffect, useCallback } from 'react'
import { TextToSpeechState } from '../types'

export interface UseVoiceCloneRecordingProps {
  state: TextToSpeechState
  updateState: (partial: Partial<TextToSpeechState>) => void
}

export function useVoiceCloneRecording({ state, updateState }: UseVoiceCloneRecordingProps) {
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)
  const recordedStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Synchronously release all microphone hardware streams & recorder
  const stopMicrophone = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (mr) {
      if (mr.state !== 'inactive') {
        try {
          if (typeof mr.requestData === 'function') {
            mr.requestData()
          }
          mr.stop()
        } catch (err) {
          console.warn('Error stopping MediaRecorder:', err)
        }
      }
      try {
        if (mr.stream) {
          mr.stream.getTracks().forEach((track) => {
            try {
              track.stop()
            } catch {}
          })
        }
      } catch {}
      mediaRecorderRef.current = null
    }

    if (recordedStreamRef.current) {
      try {
        recordedStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch {}
        })
      } catch {}
      recordedStreamRef.current = null
    }
  }, [])

  // Cleanup microphone and active audio on unmount
  useEffect(() => {
    return () => {
      stopMicrophone()
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause()
        } catch {}
        activeAudioRef.current = null
      }
    }
  }, [stopMicrophone])

  // Recording duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (state.isRecording) {
      timer = setInterval(() => {
        updateState({ recordedDuration: state.recordedDuration + 1 })
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [state.isRecording, state.recordedDuration, updateState])

  const handleStartRecord = useCallback(async () => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause()
      } catch {}
      activeAudioRef.current = null
    }
    stopMicrophone()
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordedStreamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const mimeType = mediaRecorder.mimeType || 'audio/webm'
          const blob = new Blob(audioChunksRef.current, { type: mimeType })
          const url = URL.createObjectURL(blob)
          updateState({ recordedAudioUrl: url })
        }
      }

      mediaRecorder.start(250)
      updateState({
        isPlayingRecording: false,
        recordedDuration: 0,
        recordedAudioUrl: null,
        isRecording: true,
      })
    } catch (err) {
      console.error('Microphone access failed:', err)
      updateState({ isRecording: false })
    }
  }, [stopMicrophone, updateState])

  const handleStopRecord = useCallback(() => {
    stopMicrophone()
    updateState({ isRecording: false })

    if (!state.cloneVoiceName) {
      updateState({ cloneVoiceName: 'My Cloned Voice' })
    }
  }, [stopMicrophone, state.cloneVoiceName, updateState])

  const handleSetCloneMode = useCallback(
    (mode: 'upload' | 'record') => {
      if (mode !== 'record') {
        if (state.isRecording) updateState({ isRecording: false })
        stopMicrophone()
      }
      updateState({ cloneMode: mode })
    },
    [state.isRecording, stopMicrophone, updateState]
  )

  const handleTogglePlayRecording = useCallback(() => {
    if (state.isPlayingRecording) {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause()
        } catch {}
        activeAudioRef.current = null
      }
      updateState({ isPlayingRecording: false })
      return
    }

    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause()
      } catch {}
      activeAudioRef.current = null
    }

    const currentUrl = state.recordedAudioUrl
    if (!currentUrl) {
      updateState({ isPlayingRecording: false })
      return
    }

    try {
      const audio = new Audio(currentUrl)
      activeAudioRef.current = audio

      audio.onended = () => {
        updateState({ isPlayingRecording: false })
        activeAudioRef.current = null
      }

      audio.onerror = (err) => {
        console.error('Error playing recording:', err)
        updateState({ isPlayingRecording: false })
        activeAudioRef.current = null
      }

      audio
        .play()
        .then(() => {
          updateState({ isPlayingRecording: true })
        })
        .catch((err) => {
          console.error('Playback prevented or failed:', err)
          updateState({ isPlayingRecording: false })
          activeAudioRef.current = null
        })
    } catch (err) {
      console.error('Audio initialization error:', err)
      updateState({ isPlayingRecording: false })
      activeAudioRef.current = null
    }
  }, [state.isPlayingRecording, state.recordedAudioUrl, updateState])

  return {
    recordedStreamRef,
    mediaRecorderRef,
    audioChunksRef,
    stopMicrophone,
    handleStartRecord,
    handleStopRecord,
    handleSetCloneMode,
    handleTogglePlayRecording,
  }
}
