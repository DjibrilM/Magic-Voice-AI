import { useEffect, useCallback, useRef } from 'react'
import { useAtom } from 'jotai'
import {
  PlayerTrack,
  currentTrackAtom,
  isPlayingAtom,
  currentTimeAtom,
  durationAtom,
  volumeAtom,
  isMutedAtom,
  playlistAtom,
  currentIndexAtom,
  playlistTitleAtom,
  autoplayAtom,
  isQueueOpenAtom,
  repeatModeAtom,
  isShuffleAtom,
  likedTrackIdsAtom,
} from '@/store/playerStore'
import { playerAudioService } from '@/services/playerAudioService'
import { useAudioEffect } from '@/hooks/useAudioEffect'

export function usePlayer() {
  const [currentTrack, setCurrentTrack] = useAtom(currentTrackAtom)
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom)
  const [currentTime, setCurrentTime] = useAtom(currentTimeAtom)
  const [duration, setDuration] = useAtom(durationAtom)
  const [volume, setVolumeState] = useAtom(volumeAtom)
  const [isMuted, setIsMutedState] = useAtom(isMutedAtom)
  const [playlist, setPlaylist] = useAtom(playlistAtom)
  const [currentIndex, setCurrentIndex] = useAtom(currentIndexAtom)
  const [playlistTitle, setPlaylistTitle] = useAtom(playlistTitleAtom)
  const [autoplay, setAutoplayState] = useAtom(autoplayAtom)
  const [isQueueOpen, setIsQueueOpen] = useAtom(isQueueOpenAtom)
  const [repeatMode, setRepeatMode] = useAtom(repeatModeAtom)
  const [isShuffle, setIsShuffle] = useAtom(isShuffleAtom)
  const [likedTrackIds, setLikedTrackIds] = useAtom(likedTrackIdsAtom)

  // Use refs to access latest state inside audio event listeners
  const stateRef = useRef({
    playlist,
    currentIndex,
    repeatMode,
    autoplay,
    isShuffle,
    currentTrack,
  })

  useEffect(() => {
    stateRef.current = {
      playlist,
      currentIndex,
      repeatMode,
      autoplay,
      isShuffle,
      currentTrack,
    }
  }, [playlist, currentIndex, repeatMode, autoplay, isShuffle, currentTrack])

  // Play next track in playlist (helper for track end & manual skip)
  const playNextTrack = useCallback(() => {
    const { playlist: list, currentIndex: idx, repeatMode: rep, isShuffle: shuf, autoplay: auto } = stateRef.current
    if (list.length === 0) return

    if (rep === 'one') {
      playerAudioService.seek(0)
      playerAudioService.play()
      return
    }

    let nextIdx = idx + 1
    if (shuf && list.length > 1) {
      // Pick random different index
      do {
        nextIdx = Math.floor(Math.random() * list.length)
      } while (nextIdx === idx && list.length > 1)
    }

    if (nextIdx >= list.length) {
      if (rep === 'all') {
        nextIdx = 0
      } else if (auto) {
        // If autoplay is on and at end, stop or loop if user has queue
        playerAudioService.pause()
        setIsPlaying(false)
        return
      } else {
        playerAudioService.pause()
        setIsPlaying(false)
        return
      }
    }

    const nextTrack = list[nextIdx]
    if (nextTrack) {
      setCurrentIndex(nextIdx)
      setCurrentTrack(nextTrack)
      playerAudioService.loadAndPlay(nextTrack.audioUrl)
    }
  }, [setCurrentIndex, setCurrentTrack, setIsPlaying])

  // Register to real-time central audio events via useAudioEffect (mirrors useIpcEffect architecture)
  useAudioEffect({
    onTimeUpdate: (time, dur) => {
      setCurrentTime(time)
      if (dur && !isNaN(dur) && dur > 0) {
        setDuration(dur)
      }
    },
    onStateChange: (playing) => {
      setIsPlaying(playing)
    },
    onVolumeChange: (vol, muted) => {
      setVolumeState(vol)
      setIsMutedState(muted)
    },
    onTrackEnded: () => {
      const { repeatMode: rep, autoplay: auto, playlist: list } = stateRef.current
      if (rep === 'one') {
        playerAudioService.seek(0)
        playerAudioService.play()
      } else if (list.length > 0 && auto) {
        playNextTrack()
      } else {
        setIsPlaying(false)
      }
    },
  })

  // 1. Play a single track or resume current
  const play = useCallback(
    (track?: PlayerTrack) => {
      if (track) {
        setCurrentTrack(track)
        // If the playlist doesn't contain this track, create single play or append
        const foundIdx = playlist.findIndex((t) => t.id === track.id)
        if (foundIdx >= 0) {
          setCurrentIndex(foundIdx)
        } else {
          setPlaylist([track])
          setCurrentIndex(0)
          setPlaylistTitle('Single Play')
        }
        playerAudioService.loadAndPlay(track.audioUrl)
      } else if (currentTrack) {
        playerAudioService.play()
      } else if (playlist.length > 0) {
        const idx = currentIndex >= 0 ? currentIndex : 0
        setCurrentIndex(idx)
        setCurrentTrack(playlist[idx])
        playerAudioService.loadAndPlay(playlist[idx].audioUrl)
      }
    },
    [currentTrack, playlist, currentIndex, setCurrentTrack, setCurrentIndex, setPlaylist, setPlaylistTitle]
  )

  // 2. Pause
  const pause = useCallback(() => {
    playerAudioService.pause()
  }, [])

  // 3. Toggle Play / Pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, pause, play])

  // 4. Play a Playlist: "for instance if I play a song from a list of activity that list becomes the playlist."
  const playList = useCallback(
    (tracks: PlayerTrack[], startIndex = 0, title = 'Playlist Queue') => {
      if (!tracks || tracks.length === 0) return

      const safeIndex = Math.max(0, Math.min(tracks.length - 1, startIndex))
      const targetTrack = tracks[safeIndex]

      setPlaylist(tracks)
      setPlaylistTitle(title)
      setCurrentIndex(safeIndex)
      setCurrentTrack(targetTrack)

      playerAudioService.loadAndPlay(targetTrack.audioUrl)
    },
    [setPlaylist, setPlaylistTitle, setCurrentIndex, setCurrentTrack]
  )

  // 5. Play a specific track by its index in the current playlist
  const playTrackInPlaylist = useCallback(
    (index: number) => {
      if (index < 0 || index >= playlist.length) return
      const target = playlist[index]
      setCurrentIndex(index)
      setCurrentTrack(target)
      playerAudioService.loadAndPlay(target.audioUrl)
    },
    [playlist, setCurrentIndex, setCurrentTrack]
  )

  // 6. Next Track
  const next = useCallback(() => {
    playNextTrack()
  }, [playNextTrack])

  // 7. Previous Track
  const previous = useCallback(() => {
    if (currentTime > 3) {
      playerAudioService.seek(0)
      return
    }

    if (playlist.length === 0) {
      playerAudioService.seek(0)
      return
    }

    let prevIdx = currentIndex - 1
    if (prevIdx < 0) {
      if (repeatMode === 'all') {
        prevIdx = playlist.length - 1
      } else {
        playerAudioService.seek(0)
        return
      }
    }

    const prevTrack = playlist[prevIdx]
    if (prevTrack) {
      setCurrentIndex(prevIdx)
      setCurrentTrack(prevTrack)
      playerAudioService.loadAndPlay(prevTrack.audioUrl)
    }
  }, [currentTime, playlist, currentIndex, repeatMode, setCurrentIndex, setCurrentTrack])

  // 8. Seek
  const seek = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds)) return
    const safe = Math.max(0, seconds)
    setCurrentTime(safe)
    playerAudioService.seek(safe)
  }, [setCurrentTime])

  // 9. Volume & Mute (routes to central audio, state is synced via useAudioEffect)
  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val))
    playerAudioService.setVolume(clamped)
  }, [])

  const toggleMute = useCallback(() => {
    playerAudioService.toggleMute()
  }, [])

  // 10. Shuffle & Repeat
  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev)
  }, [setIsShuffle])

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'))
  }, [setRepeatMode])

  // 11. Autoplay toggle
  const toggleAutoplay = useCallback(() => {
    setAutoplayState((prev) => !prev)
  }, [setAutoplayState])

  // 12. Queue drawer toggle
  const toggleQueue = useCallback(() => {
    setIsQueueOpen((prev) => !prev)
  }, [setIsQueueOpen])

  const setQueueOpen = useCallback(
    (open: boolean) => {
      setIsQueueOpen(open)
    },
    [setIsQueueOpen]
  )

  // 13. Like / Favorite Track
  const toggleLike = useCallback(
    (id: string) => {
      setLikedTrackIds((prev) => {
        const nextSet = new Set(prev)
        if (nextSet.has(id)) nextSet.delete(id)
        else nextSet.add(id)
        return nextSet
      })
    },
    [setLikedTrackIds]
  )

  // 14. Remove from queue
  const removeFromQueue = useCallback(
    (index: number) => {
      if (index < 0 || index >= playlist.length) return
      const updated = playlist.filter((_, i) => i !== index)
      setPlaylist(updated)

      if (index === currentIndex) {
        if (updated.length > 0) {
          const nextIdx = Math.min(index, updated.length - 1)
          setCurrentIndex(nextIdx)
          setCurrentTrack(updated[nextIdx])
          playerAudioService.loadAndPlay(updated[nextIdx].audioUrl)
        } else {
          setCurrentIndex(-1)
          setCurrentTrack(null)
          playerAudioService.pause()
        }
      } else if (index < currentIndex) {
        setCurrentIndex(currentIndex - 1)
      }
    },
    [playlist, currentIndex, setPlaylist, setCurrentIndex, setCurrentTrack]
  )

  // 15. Clear queue
  const clearQueue = useCallback(() => {
    setPlaylist([])
    setCurrentIndex(-1)
    setCurrentTrack(null)
    playerAudioService.pause()
  }, [setPlaylist, setCurrentIndex, setCurrentTrack])

  return {
    // Current Track State
    currentTrack,
    isPlaying,
    currentTime,
    duration: duration > 0 ? duration : (currentTrack?.duration ?? 0),
    volume,
    isMuted,

    // Playlist / Queue State
    playlist,
    currentIndex,
    playlistTitle,
    autoplay,
    isQueueOpen,
    repeatMode,
    isShuffle,
    likedTrackIds,
    isLiked: currentTrack ? likedTrackIds.has(currentTrack.id) : false,

    // Core Controls
    play,
    pause,
    togglePlay,
    playList,
    playTrackInPlaylist,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    toggleAutoplay,
    toggleQueue,
    setQueueOpen,
    toggleLike,
    removeFromQueue,
    clearQueue,

    // Raw audio element (for wavesurfer or direct binding if needed)
    audioElement: playerAudioService.getAudioElement(),
  }
}
