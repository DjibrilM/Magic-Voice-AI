export interface LanguageOption {
  code: string
  name: string
  nativeName: string
  flag?: string
  isAuto?: boolean
}

export interface VoiceModelOption {
  id: string
  name: string
  badge: string
  description: string
  recommended?: boolean
}
