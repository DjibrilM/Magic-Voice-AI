import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export interface PlayerTrack {
  id: string
  title: string
  subtitle?: string
  artist?: string
  category?: string
  subCategory?: string
  cover?: string
  coverUrl?: string
  audioUrl?: string
  duration?: number // in seconds
  durationFormatted?: string // e.g. "3:18"
  bpm?: number
  keyscale?: string
  waveform?: number[]
  sourceList?: string // e.g. "Recent Activity", "Studio Generations", "Marketplace"
  isInstrumental?: boolean
  originalItem?: unknown
}

// Current playback state
export const currentTrackAtom = atom<PlayerTrack | null>(null)
export const isPlayingAtom = atom<boolean>(false)
export const currentTimeAtom = atom<number>(0)
export const durationAtom = atom<number>(0)
export const volumeAtom = atomWithStorage<number>('echo_player_volume', 0.85)
export const isMutedAtom = atom<boolean>(false)

// Queue / Playlist state (YouTube Music style)
export const playlistAtom = atom<PlayerTrack[]>([])
export const currentIndexAtom = atom<number>(-1)
export const playlistTitleAtom = atom<string>('Playing from Queue')
export const autoplayAtom = atomWithStorage<boolean>('echo_player_autoplay', true)
export const isQueueOpenAtom = atom<boolean>(false)
export const repeatModeAtom = atom<'off' | 'all' | 'one'>('off')
export const isShuffleAtom = atom<boolean>(false)
export const likedTrackIdsAtom = atom<Set<string>>(new Set<string>())
