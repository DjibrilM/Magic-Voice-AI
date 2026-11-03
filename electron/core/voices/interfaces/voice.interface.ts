export interface VoicePackageInfo {
  folder: string
  language: string
  name: string
  flag: string
  code: string
  nativeName?: string
  list: string
  location: string
  listUrl: string
  count: number
}

export interface VoiceItem {
  id: string
  audio: string
  image: string
  color: string
  info?: {
    id?: string
    name?: string
    description?: string
    gender?: 'Female' | 'Male' | 'Neutral'
    tags?: string[]
    category?: 'preset' | 'cloned'
    initials?: string
    languageCode?: string
    languageName?: string
  }
  name?: string
  description?: string
  avatarUrl?: string
  sampleUrl?: string
  gender?: 'Female' | 'Male' | 'Neutral'
  tags?: string[]
  initials?: string
  category?: 'preset' | 'cloned'
  languageCode?: string
  languageName?: string
}

export interface ScanVoicePackagesResult {
  success: boolean
  packages: VoicePackageInfo[]
  error?: string
}

export interface LoadVoicesResult {
  success: boolean
  voices: VoiceItem[]
  error?: string
}
