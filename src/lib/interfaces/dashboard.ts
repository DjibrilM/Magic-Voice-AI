export interface Story {
  id: string
  title: string
  subtitle: string
  cover: string
  narrator: string
  duration: string
}

export interface MusicTrack {
  id: string
  title: string
  genre: string
  bpm: number
  model: string
  cover?: string
  trackNumber: string
  duration: string
  createdAt: string
  promptSummary: string
}

export interface ActivityItem {
  id: string
  title: string
  category: string
  subCategory: string
  type: 'audio' | 'stories' | 'texts'
  duration: string
  plays: string
  cover?: string
  waveform?: number[]
  wordsCount?: string
  textExcerpt?: string
  audioUrl?: string
}

export interface ActiveMedia {
  id: string
  title: string
  subtitle: string
  cover?: string
  duration: string
  type: 'story' | 'music' | 'activity'
}

export type ActivityTabId = 'all' | 'audio' | 'stories' | 'texts'

export interface ActivityTab {
  id: ActivityTabId
  label: string
}

export interface DashboardState {
  activeMedia: ActiveMedia | null
  isPlaying: boolean
  isMuted: boolean
  volume: number
  prevVolume: number
  currentTime: number
  activeActivityTab: ActivityTabId
  activitySearchQuery: string
  downloadedId: string | null
  copiedId: string | null
}
