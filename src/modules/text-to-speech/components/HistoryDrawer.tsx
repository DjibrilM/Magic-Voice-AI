import { useMemo } from 'react'
import {
  Search,
  X,
  Play,
  Pause,
  Sparkles,
  Copy,
  Trash2,
  Download,
  Users,
  Mic,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { HistoryEntry } from '../types'

export interface HistoryDrawerProps {
  history: HistoryEntry[]
  historySearch: string
  playingHistoryId: string | null
  activeHistoryId?: string | null
  onSearchChange: (query: string) => void
  onClearSearch: () => void
  onSelectHistoryItem: (item: HistoryEntry) => void
  onTogglePlayHistory: (item: HistoryEntry) => void
  onDeleteHistoryItem: (id: string) => void
}

/**
 * Returns a human-friendly date group label based on timestamp
 */
function getDateGroupLabel(timestamp?: number, fallback?: string): string {
  if (!timestamp) return fallback || 'Today'
  const date = new Date(timestamp)
  const now = new Date()

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  if (isToday) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  if (isYesterday) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Returns dynamic relative time ("Just now", "5m ago", "2h ago", etc.)
 */
function getTimeAgoLabel(timestamp?: number, fallback?: string): string {
  if (!timestamp) return fallback || 'Just now'
  const elapsedSec = Math.floor((Date.now() - timestamp) / 1000)
  if (elapsedSec < 45) return 'Just now'
  const elapsedMin = Math.floor(elapsedSec / 60)
  if (elapsedMin < 60) return `${elapsedMin}m ago`
  const elapsedHours = Math.floor(elapsedMin / 60)
  if (elapsedHours < 24) return `${elapsedHours}h ago`
  const elapsedDays = Math.floor(elapsedHours / 24)
  if (elapsedDays === 1) return 'Yesterday'
  if (elapsedDays < 7) return `${elapsedDays}d ago`
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Triggers download of audio or dialogue transcript text
 */
function triggerHistoryDownload(item: HistoryEntry) {
  if (item.audioUrl && item.audioUrl.startsWith('data:audio/wav')) {
    try {
      const base64 = item.audioUrl.split(',')[1]
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'audio/wav' })
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `echo-conversation-${item.id}.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
      return
    } catch (e) {
      console.warn('[HistoryDrawer] Direct wav decode failed, falling back to data URI:', e)
      const a = document.createElement('a')
      a.href = item.audioUrl
      a.download = `echo-conversation-${item.id}.wav`
      a.click()
      return
    }
  }

  // Fallback to text transcript download
  let transcript = item.text
  if (item.roundsData && item.roundsData.length > 0) {
    transcript = item.roundsData
      .map((r, i) => `[Round ${i + 1} - ${r.speakerName || 'Speaker'}]:\n${r.text.trim()}`)
      .join('\n\n')
  }

  const blob = new Blob([transcript], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `echo-conversation-${item.id}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

export function HistoryDrawer({
  history,
  historySearch,
  playingHistoryId,
  activeHistoryId,
  onSearchChange,
  onClearSearch,
  onSelectHistoryItem,
  onTogglePlayHistory,
  onDeleteHistoryItem,
}: HistoryDrawerProps) {
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history
    const q = historySearch.toLowerCase()
    return history.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        item.voiceName.toLowerCase().includes(q) ||
        (item.model && item.model.toLowerCase().includes(q)) ||
        (item.roundsData &&
          item.roundsData.some((r) => r.text.toLowerCase().includes(q) || (r.speakerName && r.speakerName.toLowerCase().includes(q))))
    )
  }, [history, historySearch])

  // Group items chronologically
  const historyGroups = useMemo(() => {
    const groups: { [key: string]: HistoryEntry[] } = {}
    filteredHistory.forEach((item) => {
      const groupLabel = getDateGroupLabel(item.timestamp, item.dateGroup)
      if (!groups[groupLabel]) groups[groupLabel] = []
      groups[groupLabel].push(item)
    })
    return groups
  }, [filteredHistory])

  // Order groups from newest to oldest
  const orderedDateGroups = useMemo(() => {
    const keys = Object.keys(historyGroups)
    return keys.sort((a, b) => {
      const itemsA = historyGroups[a] || []
      const itemsB = historyGroups[b] || []
      const maxA = Math.max(...itemsA.map((i) => i.timestamp || 0), 0)
      const maxB = Math.max(...itemsB.map((i) => i.timestamp || 0), 0)
      if (maxA && maxB) return maxB - maxA
      if (a === 'Today') return -1
      if (b === 'Today') return 1
      if (a === 'Yesterday') return -1
      if (b === 'Yesterday') return 1
      return a.localeCompare(b)
    })
  }, [historyGroups])

  return (
    <div className="w-full shrink-0 h-full overflow-y-auto px-4 pb-28 sidebar-scrollbar">
      {/* Sticky Search History Bar */}
      <div className="sticky top-0 z-20 -mx-4 px-4 pt-1.5 pb-2 bg-[#111113]">
        <div className="relative">
          <Search className="size-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={historySearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversation history..."
            className="w-full h-9 rounded-lg border-0 bg-[#161619] pl-9 pr-8 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/10 transition-colors"
          />
          {historySearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
              title="Clear Search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grouped Timeline Items */}
      <div className="pt-0.5 space-y-3">
        {orderedDateGroups.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Mic className="size-8 text-zinc-600 mx-auto mb-2.5 opacity-50" />
            <p className="text-xs font-medium text-zinc-400">No Generated Conversations Yet</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Synthesize speech to record and reload full multi-speaker dialogues.
            </p>
          </div>
        ) : (
          orderedDateGroups.map((dateLabel) => (
            <div key={dateLabel} className="space-y-2">
              {/* Centered Date Badge */}
              <div className="flex justify-center pt-2.5 pb-1.5">
                <span className="rounded-full bg-[#1c1c20] text-[10.5px] font-medium text-zinc-400 px-3 py-0.5 shadow-xs border border-white/[0.04]">
                  {dateLabel}
                </span>
              </div>

              {/* Items for this Date */}
              <div className="space-y-2">
                {historyGroups[dateLabel]?.map((item) => {
                  const isThisItemPlaying = playingHistoryId === item.id
                  const isThisItemActive = activeHistoryId === item.id
                  const roundsCount = item.roundsData?.length || 1
                  const isMultiSpeaker = roundsCount > 1 || (item.speakerCount && item.speakerCount > 1)

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectHistoryItem(item)}
                      className={cn(
                        'group relative flex items-start justify-between gap-3 p-3 rounded-xl transition-all cursor-pointer border',
                        isThisItemActive
                          ? 'bg-[#18181d] border-emerald-500/30 shadow-sm'
                          : isThisItemPlaying
                            ? 'bg-[#1a1a1e] border-white/10 shadow-sm'
                            : 'bg-[#141416]/60 border-white/[0.03] hover:bg-[#18181c] hover:border-white/[0.07]'
                      )}
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        {/* Conversation Preview Text */}
                        <p className="text-[12.5px] text-zinc-200 line-clamp-2 font-normal tracking-tight leading-snug">
                          {item.previewSnippet || item.text}
                        </p>

                        {/* Speaker & Metadata Row */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 mt-2">
                          {/* Speaker Avatar / Icon */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isMultiSpeaker ? (
                              <div
                                className="size-4 rounded-full flex items-center justify-center text-[9px] font-bold ring-1 ring-white/10"
                                style={{ backgroundColor: item.voiceColor || '#10b981' }}
                              >
                                <Users className="size-2.5 text-black" />
                              </div>
                            ) : (
                              <img
                                src={item.voiceAvatarUrl || '/voices/sterling.jpg'}
                                alt={item.voiceName}
                                className="size-4 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                              />
                            )}
                            <span className="truncate font-medium max-w-[130px] text-zinc-300">
                              {item.voiceName}
                            </span>
                          </div>

                          <span className="text-zinc-600 text-[10px]">•</span>

                          {/* Turns Badge */}
                          {roundsCount > 1 ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {roundsCount} turns
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[10.5px]">Single voice</span>
                          )}

                          {/* Engine Badge */}
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/[0.04] text-zinc-400 border border-white/[0.04]">
                            {item.engine === 'chatterbox' ? 'Chatterbox T3' : 'CosyVoice 3'}
                          </span>

                          {/* Duration */}
                          {item.duration && (
                            <>
                              <span className="text-zinc-600 text-[10px]">•</span>
                              <span className="font-mono text-zinc-400 text-[10.5px]">
                                {item.duration}
                              </span>
                            </>
                          )}

                          <span className="text-zinc-600 text-[10px]">•</span>
                          <span className="text-zinc-500 text-[10.5px]">
                            {getTimeAgoLabel(item.timestamp, item.timeAgo)}
                          </span>
                        </div>
                      </div>

                      {/* Right Hover Actions */}
                      <div
                        className={cn(
                          'items-center gap-1 shrink-0 pt-0.5',
                          isThisItemPlaying ? 'flex' : 'hidden group-hover:flex'
                        )}
                      >
                        {/* Play / Pause Button with Tooltip */}
                        <div className="relative group/play">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onTogglePlayHistory(item)
                            }}
                            className={cn(
                              'size-7 flex items-center justify-center rounded-full transition-all cursor-pointer',
                              isThisItemPlaying
                                ? 'bg-white text-black'
                                : 'bg-white/10 hover:bg-white text-white hover:text-black'
                            )}
                            title={isThisItemPlaying ? 'Pause Audio' : 'Play Audio'}
                          >
                            {isThisItemPlaying ? (
                              <Pause className="size-3.5 fill-current" />
                            ) : (
                              <Play className="size-3.5 fill-current ml-0.5" />
                            )}
                          </button>
                          {/* Tooltip bubble on hover */}
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-semibold px-2 py-0.5 rounded shadow-lg pointer-events-none opacity-0 group-hover/play:opacity-100 transition-opacity whitespace-nowrap z-30">
                            {isThisItemPlaying ? 'Pause' : 'Play'}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-[3px] border-transparent border-t-white" />
                          </div>
                        </div>

                        {/* Options Menu Button (Three Horizontal Bars) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="size-7 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer rounded hover:bg-white/5"
                              title="Options"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              >
                                <line x1="2" y1="4" x2="14" y2="4" />
                                <line x1="2" y1="8" x2="14" y2="8" />
                                <line x1="2" y1="12" x2="14" y2="12" />
                              </svg>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-48 bg-[#18181b] border-[#27272a] text-zinc-200 p-1">
                            <DropdownMenuItem
                              onClick={() => onSelectHistoryItem(item)}
                              className="text-xs cursor-pointer flex items-center gap-2"
                            >
                              <Sparkles className="size-3.5 text-emerald-400" />
                              <span>Load Full Conversation</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                let full = item.text
                                if (item.roundsData && item.roundsData.length > 0) {
                                  full = item.roundsData
                                    .map((r) => `${r.speakerName || 'Speaker'}: ${r.text.trim()}`)
                                    .join('\n')
                                }
                                navigator.clipboard.writeText(full)
                              }}
                              className="text-xs cursor-pointer flex items-center gap-2"
                            >
                              <Copy className="size-3.5" />
                              <span>Copy Script</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            <DropdownMenuItem
                              onClick={() => onDeleteHistoryItem(item.id)}
                              className="text-xs cursor-pointer text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Download Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerHistoryDownload(item)
                          }}
                          className="size-7 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer rounded hover:bg-white/5"
                          title={item.audioUrl ? 'Download WAV Audio' : 'Download Transcript'}
                        >
                          <Download className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
