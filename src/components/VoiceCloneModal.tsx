import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import {
  Upload,
  Mic,
  Square,
  RotateCcw,
  Play,
  Pause,
  User,
  Camera,
  RefreshCw,
  AlertCircle,
  FileAudio,
  X,
  Check,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LiveWaveform } from '@/components/ui/live-waveform'
import { cn } from '@/lib/utils'
import { PRESET_AVATARS, Voice } from '@/modules/text-to-speech'
import { saveCustomVoice } from '@/lib/services/voiceLoader'

export interface VoiceCloneModalProps {
  isOpen: boolean
  engine?: 'cosyvoice3' | 'chatterbox'
  onSwitchToCosyVoice?: () => void
  cloneMode: 'upload' | 'record'
  isRecording: boolean
  recordedDuration: number
  isPlayingRecording: boolean
  cloneVoiceName: string
  recordedAudioUrl?: string | null
  onClose: () => void
  onSetCloneMode: (mode: 'upload' | 'record') => void
  onStartRecord: () => void
  onStopRecord: () => void
  onTogglePlayRecording: () => void
  onStreamReady: (stream: MediaStream) => void
  onStreamEnd: () => void
  onSaveVoice: (voice: Voice) => void
}

export function VoiceCloneModal({
  isOpen,
  engine: _engine = 'cosyvoice3',
  onSwitchToCosyVoice: _onSwitchToCosyVoice,
  cloneMode,
  isRecording,
  recordedDuration,
  isPlayingRecording,
  cloneVoiceName,
  recordedAudioUrl,
  onClose,
  onSetCloneMode,
  onStartRecord,
  onStopRecord,
  onTogglePlayRecording,
  onStreamReady,
  onStreamEnd,
  onSaveVoice,
}: VoiceCloneModalProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [voiceName, setVoiceName] = useState<string>(cloneVoiceName || '')
  const [cloneGender, setCloneGender] = useState<'Female' | 'Male' | 'Neutral'>('Female')
  const [cloneDescription, setCloneDescription] = useState<string>('')
  const [cloneAvatarUrl, setCloneAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Touched state for validation error display
  const [touched, setTouched] = useState({
    name: false,
    audio: false,
    submitAttempted: false,
  })

  // Audio preview playback for uploaded file
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [previewTime, setPreviewTime] = useState(0)

  const stopAudioPreview = useCallback(() => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause()
      audioPreviewRef.current.currentTime = 0
    }
    setIsPlayingPreview(false)
    setPreviewTime(0)
  }, [])

  useEffect(() => {
    return () => {
      stopAudioPreview()
    }
  }, [stopAudioPreview])

  // Reset preview and errors on mode switch or dialog open
  useEffect(() => {
    stopAudioPreview()
    setErrorMessage(null)
  }, [cloneMode, isOpen, stopAudioPreview])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setVoiceName(cloneVoiceName || '')
      setTouched({ name: false, audio: false, submitAttempted: false })
      setErrorMessage(null)
    }
  }, [isOpen, cloneVoiceName])

  // Handle uploaded file selection
  const handleFileSelect = (file: File) => {
    stopAudioPreview()
    setUploadedFile(file)
    setTouched((prev) => ({ ...prev, audio: true }))
    setErrorMessage(null)

    // Auto-fill voice name if empty
    if (!voiceName.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase())
      setVoiceName(cleanName.slice(0, 40))
    }

    // Inspect duration
    try {
      const objectUrl = URL.createObjectURL(file)
      const tempAudio = new Audio(objectUrl)
      tempAudio.onloadedmetadata = () => {
        if (Number.isFinite(tempAudio.duration)) {
          setFileDuration(tempAudio.duration)
        }
      }
      tempAudio.onerror = () => {
        setFileDuration(null)
      }
    } catch {
      setFileDuration(null)
    }
  }

  // Toggle uploaded file preview playback
  const togglePlayAudioPreview = () => {
    if (!uploadedFile) return

    if (isPlayingPreview && audioPreviewRef.current) {
      audioPreviewRef.current.pause()
      setIsPlayingPreview(false)
      return
    }

    if (!audioPreviewRef.current) {
      const url = URL.createObjectURL(uploadedFile)
      const audio = new Audio(url)
      audioPreviewRef.current = audio

      audio.ontimeupdate = () => {
        setPreviewTime(audio.currentTime)
      }
      audio.onended = () => {
        setIsPlayingPreview(false)
        setPreviewTime(0)
      }
    }

    audioPreviewRef.current
      .play()
      .then(() => {
        setIsPlayingPreview(true)
      })
      .catch((err) => {
        console.warn('Preview playback failed:', err)
        setIsPlayingPreview(false)
      })
  }

  // Validation
  const nameError = useMemo(() => {
    const trimmed = voiceName.trim()
    if (!trimmed) {
      return 'Voice name is required'
    }
    if (trimmed.length < 2) {
      return 'Voice name must be at least 2 characters'
    }
    if (trimmed.length > 40) {
      return 'Voice name cannot exceed 40 characters'
    }
    if (!/^[a-zA-Z0-9\s._'-]+$/.test(trimmed)) {
      return 'Only letters, numbers, spaces, and hyphens allowed'
    }
    return null
  }, [voiceName])

  const audioError = useMemo(() => {
    if (cloneMode === 'upload') {
      if (!uploadedFile) {
        return 'Audio sample file is required'
      }
      if (uploadedFile.size > 25 * 1024 * 1024) {
        return 'File exceeds maximum size of 25 MB'
      }
      if (uploadedFile.size < 1000) {
        return 'Audio file is empty or corrupted'
      }
      const validExts = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.webm', '.opus']
      const lower = uploadedFile.name.toLowerCase()
      const hasExt = validExts.some((ext) => lower.endsWith(ext))
      const hasMime = uploadedFile.type.startsWith('audio/') || uploadedFile.type === ''
      if (!hasExt && !hasMime) {
        return 'Unsupported audio format. Use WAV, MP3, M4A, FLAC, or OGG'
      }
      if (fileDuration !== null && fileDuration < 2.5) {
        return `Audio sample is very short (${fileDuration.toFixed(1)}s). Minimum 3s recommended`
      }
      return null
    } else {
      if (isRecording) {
        return 'Please stop recording before creating voice'
      }
      if (recordedDuration === 0 || !recordedAudioUrl) {
        return 'Please record a voice sample'
      }
      if (recordedDuration < 3) {
        return `Recording is too short (${recordedDuration}s). Please record at least 3 seconds`
      }
      return null
    }
  }, [cloneMode, uploadedFile, fileDuration, isRecording, recordedDuration, recordedAudioUrl])

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleSave = async () => {
    setTouched({ name: true, audio: true, submitAttempted: true })
    if (nameError || audioError) {
      setErrorMessage(nameError || audioError)
      return
    }

    setErrorMessage(null)
    setIsProcessing(true)

    try {
      const voiceId = `cloned-${Date.now()}`
      let audioBuffer: ArrayBuffer

      if (cloneMode === 'upload' && uploadedFile) {
        audioBuffer = await uploadedFile.arrayBuffer()
      } else if (cloneMode === 'record' && recordedAudioUrl) {
        const res = await fetch(recordedAudioUrl)
        audioBuffer = await res.arrayBuffer()
      } else {
        throw new Error('No audio source found')
      }

      let avatarBuffer: ArrayBuffer | undefined = undefined
      let avatarFileName: string | undefined = undefined
      if (avatarFile) {
        avatarBuffer = await avatarFile.arrayBuffer()
        avatarFileName = avatarFile.name
      }

      const saveResult = await saveCustomVoice({
        voiceId,
        name: voiceName.trim(),
        audioBuffer,
        fileName: uploadedFile ? uploadedFile.name : 'recording.webm',
        avatarBuffer,
        avatarFileName,
      })

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save voice sample to disk')
      }

      const finalAvatar = saveResult.avatarUrl || cloneAvatarUrl || '/voices/sterling.jpg'
      const finalSampleUrl = saveResult.sampleUrl

      const newVoice: Voice = {
        id: voiceId,
        name: voiceName.trim(),
        description: cloneDescription.trim() || `${cloneGender} Custom Voice`,
        category: 'cloned',
        color: '#3b82f6',
        avatarUrl: finalAvatar,
        sampleUrl: finalSampleUrl,
        referenceAudioName: finalSampleUrl || uploadedFile?.name || 'Microphone Recording',
        initials: voiceName.trim().charAt(0).toUpperCase() || 'C',
        gender: cloneGender,
        tags: ['Cloned', 'Custom', cloneGender],
        languageCode: 'en',
        languageName: 'English',
      }

      onSaveVoice(newVoice)
      onClose()
    } catch (err) {
      console.error('Failed to create custom voice:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create voice')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[580px] w-full max-h-[88vh] bg-[#121214] border border-white/10 text-white p-0 shadow-2xl rounded-2xl flex flex-col overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-white/[0.08] shrink-0">
          <DialogTitle className="text-base font-semibold text-white tracking-tight">
            Bring Your Own Voice (Instant Voice Clone)
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 mt-0.5">
            Upload a short audio sample or record directly to clone a custom voice.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 sidebar-scrollbar">

          {/* Validation Error Banner */}
          {touched.submitAttempted && (errorMessage || nameError || audioError) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium"
            >
              <AlertCircle className="size-4 shrink-0 text-rose-400" />
              <div className="flex-1 min-w-0">
                {errorMessage || nameError || audioError}
              </div>
            </motion.div>
          )}

          {/* Audio Source Segmented Control */}
          <LayoutGroup id="cloneModalTabs">
            <div className="flex rounded-xl bg-[#18181b] p-1 border-none relative select-none">
              <button
                type="button"
                onClick={() => onSetCloneMode('upload')}
                className={cn(
                  'relative flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none',
                  cloneMode === 'upload' ? 'text-white' : 'text-zinc-400 hover:text-white'
                )}
              >
                {cloneMode === 'upload' && (
                  <motion.div
                    layoutId="activeCloneTabPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-white/10 rounded-lg shadow-xs"
                  />
                )}
                <Upload className="size-3.5 relative z-10" />
                <span className="relative z-10">Upload Audio</span>
              </button>
              <button
                type="button"
                onClick={() => onSetCloneMode('record')}
                className={cn(
                  'relative flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none',
                  cloneMode === 'record' ? 'text-white' : 'text-zinc-400 hover:text-white'
                )}
              >
                {cloneMode === 'record' && (
                  <motion.div
                    layoutId="activeCloneTabPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-white/10 rounded-lg shadow-xs"
                  />
                )}
                <Mic className="size-3.5 relative z-10" />
                <span className="relative z-10">Record Microphone</span>
              </button>
            </div>
          </LayoutGroup>

          {/* Content with Horizontal Translation */}
          <div className="overflow-hidden relative w-full max-w-full min-w-0">
            <motion.div
              className="flex w-full items-start"
              animate={{ x: `-${cloneMode === 'upload' ? 0 : 100}%` }}
              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
            >
              {/* Tab 1: Upload Audio */}
              <div className="w-full shrink-0 min-w-0">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    'relative rounded-2xl border transition-all min-h-[175px] flex flex-col items-center justify-center p-4 text-center',
                    isDragging
                      ? 'border-sky-500 bg-sky-500/10'
                      : uploadedFile
                      ? 'border-white/20 bg-white/[0.03]'
                      : touched.audio && audioError
                      ? 'border-rose-500/50 bg-rose-500/[0.03]'
                      : 'border-dashed border-zinc-800 hover:border-zinc-600 bg-[#121214]'
                  )}
                >
                  {!uploadedFile ? (
                    <>
                      <input
                        type="file"
                        accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac,.webm"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileSelect(e.target.files[0])
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      />

                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <div
                          className={cn(
                            'flex size-11 items-center justify-center rounded-xl border transition-colors',
                            touched.audio && audioError
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              : 'bg-white/5 border-white/10 text-zinc-300'
                          )}
                        >
                          <Upload className="size-5" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-white">
                            Drag and drop audio file, or click to browse
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1">
                            Supports MP3, WAV, M4A, FLAC, or OGG (5–30 seconds recommended, max 25MB)
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Uploaded File Preview Card with Player */
                    <div className="w-full space-y-3">
                      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 text-left">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={togglePlayAudioPreview}
                            className={cn(
                              'size-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer',
                              isPlayingPreview
                                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                                : 'bg-white text-black hover:bg-zinc-200'
                            )}
                            title={isPlayingPreview ? 'Pause sample' : 'Play audio preview'}
                          >
                            {isPlayingPreview ? (
                              <Pause className="size-4 fill-current" />
                            ) : (
                              <Play className="size-4 fill-current ml-0.5" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-white truncate flex items-center gap-1.5">
                              <FileAudio className="size-3.5 text-sky-400 shrink-0" />
                              <span className="truncate">{uploadedFile.name}</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                              {fileDuration !== null && (
                                <>
                                  <span>•</span>
                                  <span className={cn(fileDuration < 2.5 ? 'text-amber-400' : 'text-emerald-400')}>
                                    {fileDuration.toFixed(1)}s sample
                                  </span>
                                </>
                              )}
                              {isPlayingPreview && (
                                <>
                                  <span>•</span>
                                  <span className="text-sky-400 font-mono">
                                    {Math.floor(previewTime)}s
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac,.webm"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleFileSelect(e.target.files[0])
                                }
                              }}
                              className="hidden"
                            />
                            <span className="text-[11px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors inline-block">
                              Replace
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              stopAudioPreview()
                              setUploadedFile(null)
                              setFileDuration(null)
                            }}
                            className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remove file"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>

                      {/* Helper status text */}
                      <div className="text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
                        <Check className="size-3.5 text-emerald-400" />
                        <span>Ready for CosyVoice 3 reference conditioning</span>
                      </div>
                    </div>
                  )}
                </div>

                {touched.audio && audioError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1.5">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{audioError}</span>
                  </p>
                )}
              </div>

              {/* Tab 2: Record Microphone */}
              <div className="w-full shrink-0 min-w-0">
                <div
                  className={cn(
                    'rounded-2xl border min-h-[175px] bg-[#18181b]/50 p-4 text-center flex flex-col items-center justify-center gap-2.5 transition-colors',
                    touched.audio && audioError ? 'border-rose-500/40' : 'border-transparent'
                  )}
                >
                  <div className="w-full h-16 flex items-center justify-center px-4 overflow-hidden min-w-0">
                    <LiveWaveform
                      active={isRecording}
                      barWidth={3}
                      barGap={1.5}
                      barRadius={3}
                      height={56}
                      fadeEdges={true}
                      fadeWidth={24}
                      mode="static"
                      onStreamReady={onStreamReady}
                      onStreamEnd={onStreamEnd}
                      className="w-full h-full text-zinc-300"
                    />
                  </div>

                  {/* Record button and replay preview */}
                  <div className="flex items-center justify-center gap-3">
                    {isRecording ? (
                      <Button
                        type="button"
                        size="icon"
                        onClick={onStopRecord}
                        className="flex size-12 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/20 transition-all cursor-pointer shadow-md border-none"
                        title="Stop Recording"
                      >
                        <Square className="size-4.5 fill-current" />
                      </Button>
                    ) : recordedDuration > 0 ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={onStartRecord}
                          className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 border-none text-white transition-all cursor-pointer shadow-sm"
                          title="Record Again"
                        >
                          <RotateCcw className="size-4 text-zinc-300" />
                        </Button>

                        <Button
                          type="button"
                          onClick={onTogglePlayRecording}
                          className="flex items-center gap-2 h-10 px-4 rounded-full bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-all cursor-pointer shadow-md border-none"
                        >
                          {isPlayingRecording ? (
                            <>
                              <Pause className="size-3.5 fill-current" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="size-3.5 fill-current" />
                              <span>Replay Recording</span>
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="icon"
                        onClick={onStartRecord}
                        className="flex size-12 items-center justify-center rounded-full bg-white hover:bg-zinc-200 text-black transition-all cursor-pointer shadow-md border-none"
                        title="Start Recording"
                      >
                        <Mic className="size-5" />
                      </Button>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-400">
                    {isRecording
                      ? `Recording... 00:${recordedDuration < 10 ? '0' : ''}${recordedDuration} • Click Square To Stop`
                      : recordedDuration > 0
                      ? isPlayingRecording
                        ? 'Playing Back Your Voice Sample...'
                        : `Sample Captured (${recordedDuration}s) • Click Replay Recording To Listen`
                      : 'Click To Record Sample (5–30s recommended)'}
                  </div>
                </div>

                {touched.audio && audioError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1.5">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{audioError}</span>
                  </p>
                )}
              </div>
            </motion.div>
          </div>

          {/* Voice Metadata Fields */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">
                  Voice Name <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10.5px] text-zinc-500 font-mono">
                  {voiceName.length}/40
                </span>
              </div>
              <input
                type="text"
                value={voiceName}
                maxLength={40}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                onChange={(e) => {
                  const capitalized = e.target.value.replace(/(?:^|\s)\S/g, (char) =>
                    char.toUpperCase()
                  )
                  setVoiceName(capitalized)
                }}
                placeholder="E.g. Narrator, Alex, My Voice"
                className={cn(
                  'w-full h-10 rounded-xl bg-[#18181b] px-3.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-all',
                  touched.name && nameError
                    ? 'border border-rose-500/60 focus:ring-1 focus:ring-rose-500/40 bg-rose-500/[0.03]'
                    : 'border border-transparent focus:ring-1 focus:ring-white/20'
                )}
              />
              {touched.name && nameError && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 block">Gender</label>
              <div className="flex h-10 items-center rounded-xl bg-[#18181b] border-none p-1">
                {(['Female', 'Male', 'Neutral'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setCloneGender(g)}
                    className={cn(
                      'flex-1 h-full rounded-lg text-xs font-medium transition-colors cursor-pointer',
                      cloneGender === g ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Description <span className="text-[11px] text-zinc-500 font-normal">(Optional)</span>
              </label>
              <span className="text-[10.5px] text-zinc-500 font-mono">
                {cloneDescription.length}/120
              </span>
            </div>
            <input
              type="text"
              maxLength={120}
              value={cloneDescription}
              onChange={(e) => setCloneDescription(e.target.value)}
              placeholder="E.g. Warm, Conversational, Deep Timbre"
              className="w-full h-10 rounded-xl border border-transparent bg-[#18181b] px-3.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
            />
          </div>

          {/* Optional Voice Face / Avatar selection */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-medium text-zinc-300 block">
              Voice Avatar <span className="text-[11px] text-zinc-500 font-normal">(Optional)</span>
            </label>
            <div className="flex items-center gap-3.5 rounded-xl bg-[#18181b] p-3">
              <div
                onClick={() => document.getElementById('voice-face-upload')?.click()}
                className="relative size-12 shrink-0 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer hover:border-white/30 transition-all shadow-inner group"
                title="Click To Upload Voice Face Photo"
              >
                {cloneAvatarUrl ? (
                  <img src={cloneAvatarUrl} alt="Voice Face" className="size-full object-cover" />
                ) : (
                  <User className="size-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="size-4 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    accept="image/*"
                    id="voice-face-upload"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          setErrorMessage('Avatar image must be less than 5 MB')
                          return
                        }
                        setAvatarFile(file)
                        setCloneAvatarUrl(URL.createObjectURL(file))
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => document.getElementById('voice-face-upload')?.click()}
                    className="h-8 px-3 text-[11px] rounded-lg bg-white/10 hover:bg-white/15 text-white border-none cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera className="size-3" />
                    <span>Upload Photo</span>
                  </Button>

                  {cloneAvatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setAvatarFile(null)
                        setCloneAvatarUrl(null)
                      }}
                      className="h-8 px-2 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Remove Photo
                    </Button>
                  )}

                  <span className="text-[11px] text-zinc-500 hidden sm:inline">Or Preset Character</span>

                  <div className="flex items-center gap-1.5">
                    {PRESET_AVATARS.map((avatar) => (
                      <button
                        key={avatar.name}
                        type="button"
                        onClick={() => {
                          setAvatarFile(null)
                          setCloneAvatarUrl(avatar.url)
                        }}
                        className={cn(
                          'size-7 rounded-full overflow-hidden border transition-all cursor-pointer hover:scale-110',
                          cloneAvatarUrl === avatar.url
                            ? 'border-white ring-2 ring-white/40 opacity-100 scale-105'
                            : 'border-white/10 hover:border-white/40 opacity-60 hover:opacity-100'
                        )}
                        title={avatar.name}
                      >
                        <img src={avatar.url} alt={avatar.name} className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10.5px] text-zinc-500">
                  Add a portrait photo to personalize this voice card
                </p>
              </div>
            </div>
          </div>

          {/* Processing banner */}
          {isProcessing && (
            <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-3 text-xs text-zinc-300">
              <RefreshCw className="size-4 animate-spin shrink-0 text-zinc-400" />
              <span>Analyzing voice sample and generating 24kHz reference conditioning...</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 p-4 px-5 border-t border-white/[0.08] bg-[#121214] shrink-0">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="h-10 px-5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white border-none cursor-pointer transition-colors shadow-none"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isProcessing}
            onClick={handleSave}
            className={cn(
              'h-10 px-5 rounded-lg text-xs font-medium transition-all shadow-sm active:scale-98 cursor-pointer border-none',
              isProcessing
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-white hover:bg-zinc-200 text-black'
            )}
          >
            {isProcessing ? 'Creating Voice...' : 'Create Voice'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
