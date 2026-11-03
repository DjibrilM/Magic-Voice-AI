import { Voice, LanguageOption } from '../../types'

export type ExplorerTab = 'explore' | 'my-voices'
export type GenderFilter = 'all' | 'female' | 'male' | 'neutral'

export interface VoiceLanguageExplorerDialogProps {
  isOpen: boolean
  onClose: () => void
  activeVoiceId: string
  activeLanguage: LanguageOption
  voices: Voice[]
  playingVoiceId?: string | null
  onTogglePreview?: (voice: Voice, e?: React.MouseEvent) => void
  onSelectVoice: (voiceId: string) => void
  onSelectLanguage: (languageName: string) => void
  onOpenCloneModal?: () => void
  onVoicesLoaded?: (loadedVoices: Voice[]) => void
  onDeleteVoice?: (voiceId: string) => void
}
