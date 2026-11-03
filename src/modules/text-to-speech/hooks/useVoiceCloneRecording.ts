import { useRef, useEffect, useCallback, useState } from 'react'
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
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null)
  const [micError, setMicError] = useState<string | null>(null)

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
    setActiveStream(null)
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
    setMicError(null)

    // 1. Proactively request/check macOS host system microphone permissions via Electron IPC
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const permResult = await window.ipcRenderer.invoke('system:requestMicrophonePermission')
        if (permResult && !permResult.granted && permResult.status === 'denied') {
          setMicError('Microphone permission is denied in macOS System Settings. Please enable microphone access for Magic-Voice AI.')
          updateState({ isRecording: false })
          return
        }
      } catch (ipcErr) {
        console.warn('Microphone permission check via IPC failed:', ipcErr)
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      recordedStreamRef.current = stream
      setActiveStream(stream)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const actualMime = mediaRecorder.mimeType || 'audio/webm'
          const blob = new Blob(audioChunksRef.current, { type: actualMime })
          const url = URL.createObjectURL(blob)
          updateState({ recordedAudioUrl: url })
        }
      }

      mediaRecorder.start(200)
      updateState({
        isPlayingRecording: false,
        recordedDuration: 0,
        recordedAudioUrl: null,
        isRecording: true,
      })
    } catch (err: any) {
      console.error('Microphone access failed:', err)
      setActiveStream(null)
      updateState({ isRecording: false })
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
      const isNotFound = err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError'
      const msg = isDenied
        ? 'Microphone permission was denied. Please allow microphone access in macOS System Settings > Privacy & Security > Microphone.'
        : isNotFound
          ? 'No microphone input device was detected on your computer.'
          : err?.message || 'Failed to access microphone.'
      setMicError(msg)
    }
  }, [stopMicrophone, updateState])

  const handleOpenMicrophoneSettings = useCallback(async () => {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        await window.ipcRenderer.invoke('system:openMicrophoneSettings')
      } catch (err) {
        console.warn('Failed to open microphone settings:', err)
      }
    }
  }, [])

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
      setMicError(null)
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
    activeStream,
    micError,
    handleOpenMicrophoneSettings,
    stopMicrophone,
    handleStartRecord,
    handleStopRecord,
    handleSetCloneMode,
    handleTogglePlayRecording,
  }
}
