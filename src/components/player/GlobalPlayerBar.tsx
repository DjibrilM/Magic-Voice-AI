import React from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  ThumbsUp,
  Download,
  Music,
  X,
} from 'lucide-react'
import { usePlayer } from '@/hooks/usePlayer'
import { PlaylistQueuePanel } from './PlaylistQueuePanel'
import {
  ScrubBarContainer,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTrack,
} from '@/components/ui/scrub-bar'

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export const GlobalPlayerBar: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playlist,
    isQueueOpen,
    repeatMode,
    isShuffle,
    isLiked,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    toggleQueue,
    toggleLike,
    clearQueue,
  } = usePlayer()

  // Do not render bottom player if no track has been loaded/selected
  if (!currentTrack) {
    return null
  }

  const effectiveDuration = duration > 0 ? duration : (currentTrack.duration || 60)

  const handleDownload = () => {
    if (!currentTrack.audioUrl) return
    const a = document.createElement('a')
    a.href = currentTrack.audioUrl
    a.download = `${currentTrack.title || 'track'}.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <>
      {/* 1. UP NEXT Playlist Queue Floating Panel */}
      <PlaylistQueuePanel />

      {/* 2. Persistent Bottom Player Bar */}
      <div className="w-full shrink-0 bg-[#0f0f10] border-t border-white/10 pt-0 pb-2.5 flex flex-col justify-center select-none relative z-40 transition-all">
        {/* Scrubber Progress Bar with live tracking of playback time */}
        <div className="w-full mb-3 relative">
          <ScrubBarContainer
            duration={effectiveDuration || 60}
            value={currentTime}
            onScrub={(time) => seek(time)}
            className="w-full rounded-none! group"
          >
            <ScrubBarTrack className="h-1.5 rounded-none! bg-white/20 group-hover:bg-white/30 cursor-pointer relative flex items-center transition-colors">
              <ScrubBarProgress className="bg-white rounded-none!" />
              <ScrubBarThumb
                className="size-3.5 bg-white border border-white/50 shadow-[0_0_8px_rgba(0,0,0,0.8)] ring-2 ring-black/50 hover:scale-125 transition-transform"
                showValueBadge
                formatValue={(val) => formatSeconds(val)}
              />
            </ScrubBarTrack>
          </ScrubBarContainer>
        </div>

        {/* Bottom Controls Section */}
        <div className="w-full flex px-4 sm:px-6 items-center justify-between">
          {/* Left Section: Audio Tile, Title, Artist, Like */}
          <div className="flex items-center gap-3 min-w-0 max-w-[30%] sm:max-w-[35%]">
            {/* Audio Indicator Tile (Music does not come with images) */}
            <div className="size-10 rounded-lg bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
              <Music className="size-5 text-white" />
            </div>

            {/* Title and Subtitle */}
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-white truncate hover:underline cursor-pointer">
                {currentTrack.title}
              </span>
              <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                {currentTrack.artist || currentTrack.subtitle || currentTrack.category || 'Echo Music'}
              </span>
            </div>

            {/* Like / Thumbs Up (YouTube style) */}
            <button
              type="button"
              onClick={() => toggleLike(currentTrack.id)}
              className={`p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-1 ${isLiked ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              title={isLiked ? 'Liked' : 'Like'}
            >
              <ThumbsUp className={`size-4 ${isLiked ? 'fill-white' : ''}`} />
            </button>
          </div>

          {/* Center Section: Playback Controls & Time Tracker */}
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Shuffle */}
              <button
                type="button"
                onClick={toggleShuffle}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${isShuffle ? 'text-white bg-white/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                title={isShuffle ? 'Shuffle On' : 'Shuffle Off'}
              >
                <Shuffle className="size-4" />
              </button>

              {/* Previous */}
              <button
                type="button"
                onClick={previous}
                className="p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
                title="Previous Track"
              >
                <SkipBack className="size-4.5 fill-current" />
              </button>

              {/* Main Play / Pause Button (YouTube solid circle) */}
              <button
                type="button"
                onClick={togglePlay}
                className="size-10 rounded-full bg-white text-black hover:bg-zinc-200 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="size-5 fill-black" />
                ) : (
                  <Play className="size-5 fill-black ml-0.5" />
                )}
              </button>

              {/* Next */}
              <button
                type="button"
                onClick={next}
                disabled={playlist.length <= 1}
                className="p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                title="Next Track"
              >
                <SkipForward className="size-4.5 fill-current" />
              </button>

              {/* Repeat */}
              <button
                type="button"
                onClick={toggleRepeat}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${repeatMode !== 'off'
                  ? 'text-white bg-white/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === 'one' ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
              </button>
            </div>

            {/* Time Tracker: currentTime / duration */}
            <div className="font-mono text-[11px] text-zinc-400 tabular-nums">
              <span>{formatSeconds(currentTime)}</span>
              <span className="mx-1 text-zinc-600">/</span>
              <span>{formatSeconds(effectiveDuration)}</span>
            </div>
          </div>

          {/* Right Section: Volume, Download, Queue Toggle, Close */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Download Audio (.wav) */}
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex"
              title="Download Audio (.wav)"
            >
              <Download className="size-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="size-4.5 text-zinc-500" />
                ) : (
                  <Volume2 className="size-4.5 text-zinc-300" />
                )}
              </button>

              <div className="w-16 sm:w-20 flex items-center">
                <ScrubBarContainer
                  duration={100}
                  value={isMuted ? 0 : Math.round(volume * 100)}
                  onScrub={(val) => {
                    if (isMuted) toggleMute()
                    setVolume(Math.max(0, Math.min(100, val)) / 100)
                  }}
                  className="w-full group"
                  title={`Volume: ${isMuted ? 0 : Math.round(volume * 100)}%`}
                >
                  <ScrubBarTrack className="h-1 bg-white/20 group-hover:bg-white/30 rounded-full cursor-pointer relative flex items-center transition-colors">
                    <ScrubBarProgress className="bg-white" />
                    <ScrubBarThumb
                      className="size-2.5 bg-white shadow-sm ring-1 ring-black/40 hover:scale-125 transition-transform"
                      showValueBadge
                      formatValue={(val) => `${Math.round(val)}%`}
                    />
                  </ScrubBarTrack>
                </ScrubBarContainer>
              </div>

              <span className="text-[11px] font-mono text-zinc-400 w-8 tabular-nums select-none text-right">
                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
              </span>
            </div>

            {/* Queue / UP NEXT Button (YouTube style) */}
            <button
              type="button"
              onClick={toggleQueue}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${isQueueOpen
                ? 'bg-white text-black border-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/5'
                }`}
              title="Toggle Queue (UP NEXT)"
            >
              <ListMusic className="size-4" />
              <span className="text-xs font-semibold font-mono hidden md:inline">
                {playlist.length > 0 ? playlist.length : ''}
              </span>
            </button>

            {/* Dismiss / Close Player */}
            <button
              type="button"
              onClick={clearQueue}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-colors cursor-pointer"
              title="Dismiss Player"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
