import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { usePlayer } from '@/hooks/usePlayer'
import { cn } from '@/lib/utils'

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export interface TrackWavePlayerProps {
  /** Unique ID of the track to sync with player.currentTrack */
  trackId: string
  /** Normalized or raw waveform values (e.g. 0..100 or 0..1) */
  waveform?: number[]
  /** Track duration in seconds or formatted string (e.g. 60 or "1:00") */
  duration?: number | string
  /** Callback to trigger when an inactive track is clicked/scrubbed */
  onPlay?: () => void
  /** Height in pixels (default 24) */
  height?: number
  /** Width / wrapper class name (default w-full h-6) */
  className?: string
  /** Bar width in pixels (default 2.5) */
  barWidth?: number
  /** Gap between bars in pixels (default 2) */
  barGap?: number
  /** Radius of rounded bars (default 1.5) */
  barRadius?: number
  /** Color of played portion (default solid white) */
  playedColor?: string
  /** Color of unplayed portion (default translucent white) */
  unplayedColor?: string
  /** Allow clicking and dragging to seek (default true) */
  interactive?: boolean
}

// Fallback natural music waveform pattern
const DEFAULT_PEAKS = [
  25, 35, 50, 70, 85, 60, 45, 65, 80, 95, 70, 50, 40, 55, 75, 90, 80, 60, 45,
  65, 85, 70, 50, 35, 45, 60, 80, 90, 75, 55, 40, 60, 75, 85, 65, 45, 30, 50,
]

export const TrackWavePlayer: React.FC<TrackWavePlayerProps> = ({
  trackId,
  waveform,
  duration,
  onPlay,
  height = 24,
  className,
  barWidth = 2.5,
  barGap = 2,
  barRadius = 1.5,
  playedColor = '#ffffff',
  unplayedColor = 'rgba(255, 255, 255, 0.28)',
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { currentTrack, isPlaying, currentTime, duration: globalDuration, seek } = usePlayer()

  const [isHovered, setIsHovered] = useState(false)
  const [hoverRatio, setHoverRatio] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Is this track the one currently in the global player?
  const isCurrentTrack = currentTrack?.id === trackId

  // Parse track duration in seconds - prioritize live audio duration when playing
  const trackDurationSec = useMemo(() => {
    if (isCurrentTrack && globalDuration > 0) return globalDuration
    if (typeof duration === 'number' && duration > 0) return duration
    if (typeof duration === 'string') {
      const trimmed = duration.trim()
      if (trimmed.includes(':')) {
        const parts = trimmed.split(':').map((p) => parseInt(p, 10))
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return parts[0] * 60 + parts[1]
        }
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          return parts[0] * 3600 + parts[1] * 60 + parts[2]
        }
      }
      const match = trimmed.match(/(?:(\d+)\s*m)?\s*(\d+)\s*s?/i)
      if (match && (match[1] || match[2])) {
        const mins = match[1] ? parseInt(match[1], 10) : 0
        const secs = match[2] ? parseInt(match[2], 10) : 0
        const total = mins * 60 + secs
        if (total > 0) return total
      }
    }
    if (isCurrentTrack && currentTrack?.duration && currentTrack.duration > 0) {
      return currentTrack.duration
    }
    return 60
  }, [duration, isCurrentTrack, globalDuration, currentTrack?.duration])

  // Playback progress ratio (0 to 1) reflecting the main player state
  const progressRatio = useMemo(() => {
    if (!isCurrentTrack || trackDurationSec <= 0) return 0
    return Math.min(1, Math.max(0, currentTime / trackDurationSec))
  }, [isCurrentTrack, trackDurationSec, currentTime])

  // Normalized peaks array (0.1 to 1.0)
  const peaks = useMemo(() => {
    const raw = waveform && waveform.length > 0 ? waveform : DEFAULT_PEAKS
    return raw.map((v) => {
      const num = v > 1 ? v / 100 : v
      return Math.max(0.12, Math.min(1.0, num))
    })
  }, [waveform])

  // Redraw canvas bars based on size and progress
  const renderBars = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const width = Math.floor(rect.width)
    if (width <= 0) return

    const dpr = window.devicePixelRatio || 1
    const h = height
    const targetBufferWidth = Math.floor(width * dpr)
    const targetBufferHeight = Math.floor(h * dpr)

    if (canvas.width !== targetBufferWidth || canvas.height !== targetBufferHeight) {
      canvas.width = targetBufferWidth
      canvas.height = targetBufferHeight
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, h)

    const step = barWidth + barGap
    const barCount = Math.floor(width / step)
    const centerY = h / 2

    // Current progress split point in pixels
    const progressX = width * progressRatio
    const hoverX = hoverRatio !== null ? width * hoverRatio : null

    for (let i = 0; i < barCount; i++) {
      const barX = i * step
      const peakIdx = Math.floor((i / barCount) * peaks.length)
      const peakVal = peaks[peakIdx] || 0.3
      const barH = Math.max(4, peakVal * (h * 0.9))
      const barY = centerY - barH / 2

      // Check whether this bar is in the played portion
      const isPlayed = isCurrentTrack && barX + barWidth / 2 <= progressX
      const isHoveredPast = hoverX !== null && barX + barWidth / 2 <= hoverX

      if (isPlayed) {
        ctx.fillStyle = playedColor
        ctx.globalAlpha = 1.0
      } else if (isHoveredPast) {
        ctx.fillStyle = playedColor
        ctx.globalAlpha = 0.6
      } else {
        ctx.fillStyle = unplayedColor
        ctx.globalAlpha = isCurrentTrack ? 0.45 : 0.75
      }

      if (barRadius > 0 && typeof ctx.roundRect === 'function') {
        ctx.beginPath()
        ctx.roundRect(barX, barY, barWidth, barH, barRadius)
        ctx.fill()
      } else {
        ctx.fillRect(barX, barY, barWidth, barH)
      }
    }

    // Draw live animated playback head cursor when this track is actively playing
    if (isCurrentTrack && progressX > 0 && progressX < width) {
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = 1.0
      ctx.beginPath()
      ctx.arc(progressX, centerY, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }, [
    peaks,
    height,
    barWidth,
    barGap,
    barRadius,
    playedColor,
    unplayedColor,
    isCurrentTrack,
    progressRatio,
    hoverRatio,
  ])

  // Re-render when size, progress, or hover changes
  useEffect(() => {
    renderBars()
  }, [renderBars])

  // ResizeObserver to adapt smoothly to any container size with RAF debounce
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let rafId: number | null = null
    const observer = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        renderBars()
      })
    })
    observer.observe(container)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [renderBars])

  // Scrubbing / Seek handler
  const handleSeekFromEvent = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const ratio = Math.max(0, Math.min(1, offsetX / rect.width))
    const targetSeconds = ratio * trackDurationSec

    if (isCurrentTrack) {
      seek(targetSeconds)
    } else {
      onPlay?.()
      setTimeout(() => {
        seek(targetSeconds)
      }, 50)
    }
  }, [trackDurationSec, isCurrentTrack, seek, onPlay])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return
    e.stopPropagation()
    setIsDragging(true)
    handleSeekFromEvent(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!interactive || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverRatio(ratio)

    if (isDragging) {
      handleSeekFromEvent(e.clientX)
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const onGlobalMouseMove = (e: MouseEvent) => {
      handleSeekFromEvent(e.clientX)
    }

    const onGlobalMouseUp = () => {
      setIsDragging(false)
      // A drag that ends outside the wave still emits a click on a common ancestor
      // (e.g. the track card's play toggle). Swallow that one click.
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, true), 0)
    }

    window.addEventListener('mousemove', onGlobalMouseMove)
    window.addEventListener('mouseup', onGlobalMouseUp)

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove)
      window.removeEventListener('mouseup', onGlobalMouseUp)
    }
  }, [isDragging, handleSeekFromEvent])

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onClick={(e) => interactive && e.stopPropagation()}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setHoverRatio(null)
      }}
      className={cn(
        'relative flex items-center select-none overflow-hidden min-w-0 w-full',
        interactive ? 'cursor-pointer group' : 'pointer-events-none',
        className
      )}
      style={{ height }}
      title={
        isCurrentTrack
          ? `${isPlaying ? 'Playing' : 'Paused'}: ${formatSeconds(currentTime)} / ${formatSeconds(trackDurationSec)}`
          : 'Click to play from here'
      }
    >
      <canvas ref={canvasRef} className="block w-full h-full min-w-0 max-w-full" />

      {/* Hover Time Tooltip */}
      {interactive && isHovered && hoverRatio !== null && (
        <div
          className="absolute -top-7 text-[10px] font-mono text-white bg-black/90 border border-white/10 px-1.5 py-0.5 rounded shadow pointer-events-none -translate-x-1/2 z-20 whitespace-nowrap"
          style={{ left: `${hoverRatio * 100}%` }}
        >
          {formatSeconds(hoverRatio * trackDurationSec)}
        </div>
      )}
    </div>
  )
}

export default TrackWavePlayer
