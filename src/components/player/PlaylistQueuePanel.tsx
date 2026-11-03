import React from 'react'
import {
  X,
  Volume2,
  Play,
  Trash2,
  Music,
  ListMusic,
} from 'lucide-react'
import { usePlayer } from '@/hooks/usePlayer'

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export const PlaylistQueuePanel: React.FC = () => {
  const {
    playlist,
    currentIndex,
    playlistTitle,
    currentTrack,
    isPlaying,
    autoplay,
    isQueueOpen,
    toggleQueue,
    toggleAutoplay,
    playTrackInPlaylist,
    togglePlay,
    removeFromQueue,
    clearQueue,
  } = usePlayer()

  if (!isQueueOpen) return null

  return (
    <div
      className="absolute right-3 bottom-[76px] z-50 w-80 sm:w-96 max-h-[calc(100vh-140px)] flex flex-col rounded-2xl border border-white/10 bg-[#121214]/95 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
      style={{
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* 1. Panel Header (YouTube Music "UP NEXT") */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <ListMusic className="size-4 text-white" />
          <h3 className="text-xs font-bold tracking-wider uppercase text-white">UP NEXT</h3>
          <span className="text-[11px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
            {playlist.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {playlist.length > 0 && (
            <button
              type="button"
              onClick={clearQueue}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer text-[11px]"
              title="Clear queue"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleQueue}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close queue"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* 2. Subheader: Playing From & Autoplay Toggle */}
      <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Playing from</span>
          <span className="text-xs font-semibold text-zinc-200 truncate block">
            {playlistTitle || 'Queue'}
          </span>
        </div>

        {/* Autoplay Switch */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-zinc-400 font-medium">Autoplay</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoplay}
            onClick={toggleAutoplay}
            className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              autoplay ? 'bg-white' : 'bg-zinc-700'
            }`}
            title="Toggle queue autoplay"
          >
            <span
              className={`pointer-events-none inline-block size-3.5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                autoplay ? 'translate-x-3.5' : 'translate-x-0 bg-zinc-300'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 3. Playlist Songs List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-transparent min-h-[160px] max-h-[380px] scrollbar-thin">
        {playlist.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
            <Music className="size-8 text-zinc-600" />
            <span>The queue is empty.</span>
            <span className="text-[11px] text-zinc-600">Play a song or list to populate UP NEXT.</span>
          </div>
        ) : (
          playlist.map((item, idx) => {
            const isCurrent = (currentTrack && currentTrack.id === item.id) || idx === currentIndex

            return (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => {
                  if (isCurrent) {
                    togglePlay()
                  } else {
                    playTrackInPlaylist(idx)
                  }
                }}
                className={`group flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-white/10 border border-white/10 shadow-sm text-white'
                    : 'hover:bg-white/5 text-zinc-300 hover:text-white border border-transparent'
                }`}
              >
                {/* Left: Thumbnail + Title + Artist */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  {/* Audio Indicator */}
                  <div className="relative size-10 rounded-lg bg-white/5 shrink-0 border border-white/10 flex items-center justify-center">
                    {isCurrent ? (
                      isPlaying ? (
                        <Volume2 className="size-4 text-white animate-pulse" />
                      ) : (
                        <Play className="size-3.5 text-white fill-white ml-0.5" />
                      )
                    ) : (
                      <Music className="size-4 text-white" />
                    )}
                  </div>

                  {/* Title & Artist/Category */}
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isCurrent ? 'text-white' : 'text-zinc-200 group-hover:text-white'
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {item.artist || item.subtitle || item.category || 'Audio Track'}
                    </span>
                  </div>
                </div>

                {/* Right: Duration & Hover Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                    {item.durationFormatted || (item.duration ? formatSeconds(item.duration) : '1:00')}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFromQueue(idx)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-all cursor-pointer"
                    title="Remove from queue"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
