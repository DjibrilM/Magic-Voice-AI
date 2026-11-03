import React, { useState, useRef, useEffect } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
  Download,
  Music2,
  Video,
  Maximize2,
  X,
} from 'lucide-react'
import {
  ScrubBarContainer,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTrack,
} from '@/components/ui/scrub-bar'

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export interface MediaPlayerTrack {
  id: string
  title: string
  subtitle?: string
  cover?: string
  audioUrl?: string
  videoUrl?: string
  duration?: number
  bpm?: number
  keyscale?: string
  waveform?: number[]
}

export interface BottomPlayerBarProps {
  track?: MediaPlayerTrack | null
  title?: string
  subtitle?: string
  cover?: string
  audioUrl?: string
  videoUrl?: string

  isPlaying: boolean
  currentTime: number
  duration: number
  isMuted?: boolean
  volume?: number // 0 to 1

  onTogglePlay: () => void
  onSeek: (seconds: number) => void
  onSkip?: (seconds: number) => void
  onToggleMute?: () => void
  onVolumeChange?: (volume: number) => void
  onDownload?: () => void

  className?: string
  isAbsolute?: boolean
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  track,
  title: propTitle,
  subtitle: propSubtitle,
  audioUrl: propAudioUrl,
  videoUrl: propVideoUrl,

  isPlaying,
  currentTime,
  duration,
  isMuted = false,
  volume = 0.85,

  onTogglePlay,
  onSeek,
  onSkip,
  onToggleMute,
  onVolumeChange,
  onDownload,

  className = '',
  isAbsolute = true,
}) => {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const title = propTitle || track?.title || 'Active Track'
  const subtitle = propSubtitle || track?.subtitle || (track?.bpm ? `${track.bpm} BPM` : 'Media Audio')
  const audioUrl = propAudioUrl || track?.audioUrl
  const videoUrl = propVideoUrl || track?.videoUrl
  const hasVideo = Boolean(videoUrl)

  // Sync modal video playback with player state
  useEffect(() => {
    if (videoRef.current && isVideoModalOpen) {
      if (isPlaying) {
        videoRef.current.play().catch(() => { })
      } else {
        videoRef.current.pause()
      }
    }
  }, [isPlaying, isVideoModalOpen])

  useEffect(() => {
    if (videoRef.current && isVideoModalOpen) {
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
        videoRef.current.currentTime = currentTime
      }
    }
  }, [currentTime, isVideoModalOpen])

  const handleSkip = (seconds: number) => {
    if (onSkip) {
      onSkip(seconds)
    } else {
      const next = Math.max(0, Math.min(duration || 60, currentTime + seconds))
      onSeek(next)
    }
  }

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    } else if (audioUrl) {
      const a = document.createElement('a')
      a.href = audioUrl
      a.download = `${title.replace(/\s+/g, '_')}.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <>
      <div
        className={`${isAbsolute ? 'absolute bottom-0 left-0 right-0' : 'relative w-full'
          } border-t border-[#1f1f23] bg-[#0f0f10] px-6 flex items-center justify-between z-20 select-none ${className}`}
      >
        {/* Left: Active snippet & Media Thumbnail (Audio / Video) */}
        <div className="flex items-center gap-3 min-w-[200px] max-w-[280px]">
          {/* Media Thumbnail */}
          <div
            onClick={() => hasVideo && setIsVideoModalOpen(true)}
            className={`relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#161619] border border-[#27272a] text-zinc-300 overflow-hidden ${hasVideo ? 'cursor-pointer hover:border-zinc-500 group/thumb' : ''
              }`}
            title={hasVideo ? 'Click to expand video player' : title}
          >
            {hasVideo && videoUrl ? (
              <>
                <video
                  src={videoUrl}
                  className="size-full object-cover"
                  muted
                  playsInline
                  autoPlay={isPlaying}
                  loop
                />
                <div className="absolute inset-0 bg-black/30 group-hover/thumb:bg-black/10 flex items-center justify-center transition-colors">
                  <Video className="size-3.5 text-white/90" />
                </div>
              </>
            ) : (
              <Music2 className="size-4 text-white" />
            )}
          </div>

          {/* Title & Subtitle */}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-zinc-200 truncate" title={title}>
              {title}
            </span>
            <span className="text-[11px] text-zinc-500 truncate font-mono">
              {subtitle}
            </span>
          </div>
        </div>

        {/* Center: Playback Controls & Scrubber */}
        <div className="flex flex-1 max-w-xl items-center gap-4 px-4">
          <span className="text-[11px] font-mono text-zinc-500 w-10 text-right">
            {formatSeconds(currentTime)}
          </span>

          {/* Skip back 5s */}
          <button
            type="button"
            onClick={() => handleSkip(-5)}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Rewind 5s"
          >
            <RotateCcw className="size-4" />
          </button>

          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 transition-transform active:scale-95 cursor-pointer shadow-sm"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Skip forward 5s */}
          <button
            type="button"
            onClick={() => handleSkip(5)}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Fast Forward 5s"
          >
            <RotateCw className="size-4" />
          </button>

          {/* Scrubber Scrub-Bar */}
          <div className="flex-1">
            <ScrubBarContainer
              duration={duration || 60}
              value={currentTime}
              onScrub={(time) => onSeek(time)}
              className="w-full group"
            >
              <ScrubBarTrack className="h-1.5 bg-white/20 group-hover:bg-white/30 rounded-full cursor-pointer relative flex items-center transition-colors">
                <ScrubBarProgress className="bg-white" />
                <ScrubBarThumb
                  className="size-3.5 bg-white border border-white/50 shadow-[0_0_8px_rgba(0,0,0,0.8)] ring-2 ring-black/50 hover:scale-125 transition-transform"
                  showValueBadge
                  formatValue={(val) => formatSeconds(val)}
                />
              </ScrubBarTrack>
            </ScrubBarContainer>
          </div>

          <span className="text-[11px] font-mono text-zinc-500 w-10">
            {formatSeconds(duration || 60)}
          </span>
        </div>

        {/* Right: Volume & Actions (Download, Video Fullscreen) */}
        <div className="flex items-center gap-3.5 min-w-[200px] justify-end">
          {/* Interactive Volume Control */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded-md hover:bg-white/[0.06]"
              title={isMuted || volume === 0 ? 'Unmute' : `Mute (${Math.round(volume * 100)}%)`}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="size-4 text-zinc-500" />
              ) : volume < 0.5 ? (
                <Volume1 className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>

            <div className="w-20 sm:w-24 flex items-center">
              <ScrubBarContainer
                duration={100}
                value={isMuted ? 0 : Math.round(volume * 100)}
                onScrub={(val) => onVolumeChange?.(val / 100)}
                className="w-full group"
                title={`Volume: ${isMuted ? 0 : Math.round(volume * 100)}%`}
              >
                <ScrubBarTrack className="h-1 bg-white/25 group-hover:bg-white/35 rounded-full cursor-pointer relative flex items-center transition-colors">
                  <ScrubBarProgress className="bg-white" />
                  <ScrubBarThumb
                    className="size-2.5 bg-white shadow-sm ring-1 ring-black/40 hover:scale-125 transition-transform"
                    showValueBadge
                    formatValue={(val) => `${Math.round(val)}%`}
                  />
                </ScrubBarTrack>
              </ScrubBarContainer>
            </div>

            <span className="text-[10px] font-mono text-zinc-400 w-7 tabular-nums select-none text-right">
              {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
            </span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Video expand button if media has video */}
          {hasVideo && (
            <button
              type="button"
              onClick={() => setIsVideoModalOpen(true)}
              className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/[0.06] cursor-pointer"
              title="Expand Video Player"
            >
              <Maximize2 className="size-4" />
            </button>
          )}

          {/* Download button */}
          {(onDownload || audioUrl) && (
            <button
              type="button"
              onClick={handleDownload}
              className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/[0.06] cursor-pointer"
              title="Download Audio"
            >
              <Download className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Video Player Modal */}
      {isVideoModalOpen && videoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="relative w-full max-w-3xl bg-[#141416] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#1f1f23] bg-[#0c0c0e]">
              <div className="flex items-center gap-2">
                <Video className="size-4 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-200 truncate">{title}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsVideoModalOpen(false)}
                className="size-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Close video"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                src={videoUrl}
                className="size-full object-contain"
                controls
                playsInline
                autoPlay={isPlaying}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
export default BottomPlayerBar
