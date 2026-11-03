"use client"

import * as React from "react"
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type HTMLAttributes,
} from "react"

import { cn } from "@/lib/utils"

function formatTimestamp(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00"
  const totalSeconds = Math.floor(value)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

interface ScrubBarContextValue {
  duration: number
  value: number
  progress: number
  isScrubbing: boolean
  onScrub?: (time: number) => void
  onScrubStart?: () => void
  onScrubEnd?: () => void
  setScrubValue: (val: number | null) => void
}

const ScrubBarContext = createContext<ScrubBarContextValue | null>(null)

function useScrubBarContext() {
  const context = useContext(ScrubBarContext)
  if (!context) {
    throw new Error("useScrubBarContext must be used within a ScrubBar.Root")
  }
  return context
}

interface ScrubBarContainerProps extends HTMLAttributes<HTMLDivElement> {
  duration: number
  value: number
  onScrub?: (time: number) => void
  onScrubStart?: () => void
  onScrubEnd?: () => void
}

function ScrubBarContainer({
  duration,
  value,
  onScrub,
  onScrubStart,
  onScrubEnd,
  children,
  className,
  ...props
}: ScrubBarContainerProps) {
  const [scrubValue, setScrubValue] = React.useState<number | null>(null)
  const isScrubbing = scrubValue !== null
  const displayValue = isScrubbing ? scrubValue : (Number.isFinite(value) ? value : 0)
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  const progress = Math.min(100, Math.max(0, (displayValue / safeDuration) * 100))

  const contextValue: ScrubBarContextValue = {
    duration: safeDuration,
    value: displayValue,
    progress,
    isScrubbing,
    onScrub,
    onScrubStart,
    onScrubEnd,
    setScrubValue,
  }

  return (
    <ScrubBarContext.Provider value={contextValue}>
      <div
        data-slot="scrub-bar-root"
        className={cn("flex w-full items-center", className)}
        {...props}
      >
        {children}
      </div>
    </ScrubBarContext.Provider>
  )
}
ScrubBarContainer.displayName = "ScrubBarContainer"

type ScrubBarTrackProps = HTMLAttributes<HTMLDivElement>

function ScrubBarTrack({ className, children, ...props }: ScrubBarTrackProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const { duration, onScrub, onScrubStart, onScrubEnd, value, setScrubValue } =
    useScrubBarContext()

  const getTimeFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || !duration) return null
      const rect = track.getBoundingClientRect()
      if (rect.width <= 0) return 0
      const ratio = (clientX - rect.left) / rect.width
      const clamped = Math.min(Math.max(ratio, 0), 1)
      return duration * clamped
    },
    [duration]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return
      event.preventDefault()
      onScrubStart?.()

      const time = getTimeFromClientX(event.clientX)
      if (time != null) {
        setScrubValue(time)
        onScrub?.(time)
      }

      const handleMove = (moveEvent: PointerEvent) => {
        const nextTime = getTimeFromClientX(moveEvent.clientX)
        if (nextTime != null) {
          setScrubValue(nextTime)
          onScrub?.(nextTime)
        }
      }

      const handleUp = (upEvent: PointerEvent) => {
        const finalTime = getTimeFromClientX(upEvent.clientX)
        if (finalTime != null) {
          onScrub?.(finalTime)
        }
        setScrubValue(null)
        onScrubEnd?.()
        window.removeEventListener("pointermove", handleMove)
        window.removeEventListener("pointerup", handleUp)
        window.removeEventListener("pointercancel", handleUp)
      }

      window.addEventListener("pointermove", handleMove)
      window.addEventListener("pointerup", handleUp, { once: true })
      window.addEventListener("pointercancel", handleUp, { once: true })
    },
    [duration, getTimeFromClientX, onScrub, onScrubEnd, onScrubStart, setScrubValue]
  )

  const clampedValue = Math.min(Math.max(value, 0), duration || 0)

  return (
    <div
      ref={trackRef}
      data-slot="scrub-bar-track"
      className={cn(
        "bg-secondary relative h-2 w-full grow cursor-pointer touch-none rounded-full transition-none select-none",
        className
      )}
      onPointerDown={handlePointerDown}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration || 0}
      aria-valuenow={clampedValue}
      {...props}
    >
      {children}
    </div>
  )
}
ScrubBarTrack.displayName = "ScrubBarTrack"

type ScrubBarProgressProps = HTMLAttributes<HTMLDivElement>

function ScrubBarProgress({ className, ...props }: ScrubBarProgressProps) {
  const { progress } = useScrubBarContext()
  const clamped = Math.min(100, Math.max(0, progress))

  return (
    <div
      data-slot="scrub-bar-progress"
      className={cn("absolute left-0 top-0 h-full rounded-full bg-white transition-none pointer-events-none", className)}
      style={{ width: `${clamped}%` }}
      {...props}
    />
  )
}
ScrubBarProgress.displayName = "ScrubBarProgress"

export interface ScrubBarThumbProps extends HTMLAttributes<HTMLDivElement> {
  showValueBadge?: boolean
  formatValue?: (val: number) => string
}

function ScrubBarThumb({ className, children, showValueBadge, formatValue, ...props }: ScrubBarThumbProps) {
  const { progress, value } = useScrubBarContext()
  const clamped = Math.min(100, Math.max(0, progress))

  return (
    <div
      data-slot="scrub-bar-thumb"
      className={cn(
        "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 block rounded-full bg-white transition-none pointer-events-none select-none",
        className
      )}
      style={{ left: `${clamped}%` }}
      {...props}
    >
      {showValueBadge && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#141416] border border-white/20 text-[10px] font-mono text-white whitespace-nowrap shadow-xl pointer-events-none">
          {formatValue ? formatValue(value) : formatTimestamp(value)}
        </div>
      )}
      {children}
    </div>
  )
}
ScrubBarThumb.displayName = "ScrubBarThumb"

interface ScrubBarTimeLabelProps extends HTMLAttributes<HTMLSpanElement> {
  time: number
  format?: (time: number) => string
}

function ScrubBarTimeLabel({
  className,
  time,
  format = formatTimestamp,
  ...props
}: ScrubBarTimeLabelProps) {
  return (
    <span
      data-slot="scrub-bar-time-label"
      {...props}
      className={cn("tabular-nums", className)}
    >
      {format(time)}
    </span>
  )
}
ScrubBarTimeLabel.displayName = "ScrubBarTimeLabel"

export {
  ScrubBarContainer,
  ScrubBarTrack,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTimeLabel,
}
