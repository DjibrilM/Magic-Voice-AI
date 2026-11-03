import { Play, Pause, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Voice, LANGUAGES } from '../../types'

interface VoiceListItemProps {
  voice: Voice
  isSelected: boolean
  isPlaying: boolean
  selectedCategories: string[]
  onTogglePreview?: (voice: Voice, e?: React.MouseEvent) => void
  onSelectVoice: (voiceId: string) => void
  onSelectLanguage: (languageName: string) => void
  onToggleCategory: (category: string) => void
  onClose: () => void
  onDeleteVoice?: (voiceId: string) => void
}

export function VoiceListItem({
  voice,
  isSelected,
  isPlaying,
  selectedCategories,
  onTogglePreview,
  onSelectVoice,
  onSelectLanguage,
  onToggleCategory,
  onClose,
  onDeleteVoice,
}: VoiceListItemProps) {
  // Resolve flag for voice
  const langMatch =
    LANGUAGES.find((l) => l.code === voice.languageCode) ||
    LANGUAGES.find((l) =>
      voice.tags.some((t) => t.toLowerCase() === l.name.toLowerCase())
    ) || { flag: '🇺🇸', name: 'English' }

  const handleSelect = () => {
    onSelectVoice(voice.id)
    if (voice.languageName) {
      onSelectLanguage(voice.languageName)
    }
    onClose()
  }

  return (
    <div
      onClick={handleSelect}
      className={cn(
        'group flex items-center justify-between p-2.5 px-3 rounded-xl border transition-all cursor-pointer',
        isSelected
          ? 'border-white/30 bg-white/[0.08] shadow-sm'
          : 'border-transparent hover:border-[#27272a] hover:bg-[#161619]'
      )}
    >
      {/* Left: Avatar with play audition button overlay + Name/Desc */}
      <div className="flex items-center gap-3 min-w-0 pr-3 flex-1">
        <div
          onClick={(e) => {
            e.stopPropagation()
            if (voice.sampleUrl && onTogglePreview) {
              onTogglePreview(voice, e)
            }
          }}
          className="relative size-9 shrink-0 rounded-full overflow-hidden ring-1 ring-white/10 group/avatar cursor-pointer"
          title={isPlaying ? 'Pause preview' : 'Audition voice sample'}
        >
          <img
            src={voice.avatarUrl || '/voices/sterling.jpg'}
            alt={voice.name}
            className="size-full object-cover"
          />
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center transition-all',
              isPlaying
                ? 'bg-black/60 opacity-100'
                : 'bg-black/40 opacity-0 group-hover:opacity-100'
            )}
          >
            {isPlaying ? (
              <Pause className="size-3.5 fill-white text-white animate-pulse" />
            ) : (
              <Play className="size-3.5 fill-white text-white ml-0.5" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate">
            <span className="text-xs font-semibold text-white truncate">
              {voice.name}
            </span>
            {voice.category === 'cloned' && (
              <span className="text-[9px] bg-white/10 border border-white/10 text-zinc-300 px-1.5 py-0.5 rounded font-medium">
                Custom
              </span>
            )}
          </div>

          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
            {voice.description}
          </div>
        </div>
      </div>

      {/* Middle: Language Flag & Clickable Category/Style Tag Badges */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap max-w-[280px] justify-end">
        <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
          <span className="text-sm leading-none">{langMatch.flag}</span>
          <span className="text-[11.5px] text-zinc-300">{langMatch.name}</span>
        </div>

        {voice.tags.map((tag) => {
          const isTagActive = selectedCategories.some(
            (c) => c.toLowerCase() === tag.toLowerCase()
          )
          return (
            <button
              key={tag}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleCategory(tag)
              }}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded transition-all cursor-pointer border',
                isTagActive
                  ? 'bg-sky-500/25 border-sky-500/40 text-sky-300 font-medium'
                  : 'bg-white/[0.04] border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-zinc-500'
              )}
              title={`Filter by ${tag}`}
            >
              {tag}
            </button>
          )
        })}
      </div>

      {/* Right: Active status / Select button / Delete custom voice */}
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {voice.category === 'cloned' && onDeleteVoice && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteVoice(voice.id)
            }}
            title="Delete custom voice"
            className="size-7 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}

        {isSelected ? (
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
            <Check className="size-3" />
            <span>Active</span>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            className="opacity-0 group-hover:opacity-100 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg px-2.5 h-7 transition-all"
          >
            Use
          </Button>
        )}
      </div>
    </div>
  )
}
