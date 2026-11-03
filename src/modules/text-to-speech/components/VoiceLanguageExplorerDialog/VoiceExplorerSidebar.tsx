import { useState } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { LanguageOption } from '@/lib/interfaces/model'
import { LANGUAGES } from '../../types'
import { CATEGORY_CHIPS } from './constants'
import { GenderFilter } from './types'

interface VoiceExplorerSidebarProps {
  selectedLanguageCode: string
  onSelectLanguageCode: (code: string) => void
  onSelectLanguageName: (name: string) => void
  selectedGender: GenderFilter
  onSelectGender: (gender: GenderFilter) => void
  selectedCategories: string[]
  onToggleCategory: (category: string) => void
  selectedLangObj: { name: string; flag?: string }
  availableLanguages?: LanguageOption[]
}

export function VoiceExplorerSidebar({
  selectedLanguageCode,
  onSelectLanguageCode,
  onSelectLanguageName,
  selectedGender,
  onSelectGender,
  selectedCategories,
  onToggleCategory,
  selectedLangObj,
  availableLanguages,
}: VoiceExplorerSidebarProps) {
  const [isGenderExpanded, setIsGenderExpanded] = useState(true)
  const languagesList = availableLanguages && availableLanguages.length > 0 ? availableLanguages : LANGUAGES

  return (
    <aside className="w-64 shrink-0 border-r border-[#1f1f23] bg-[#0c0c0e] flex flex-col h-full overflow-y-auto sidebar-scrollbar p-4 space-y-5 select-none">
      {/* 1. Language Dropdown Filter */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase flex items-center justify-between">
          <span>Language</span>
          {selectedLanguageCode !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectLanguageCode('all')}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 font-normal lowercase cursor-pointer"
            >
              reset
            </button>
          )}
        </label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between rounded-xl border border-[#27272a] bg-[#161619] hover:bg-[#1f1f23] hover:border-zinc-600 px-3 py-2 text-xs text-white transition-colors cursor-pointer shadow-xs group"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-sm leading-none shrink-0">{selectedLangObj.flag}</span>
                <span className="truncate font-medium">{selectedLangObj.name}</span>
              </div>
              <ChevronDown className="size-3.5 text-zinc-400 group-hover:text-zinc-200 shrink-0 ml-1.5" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            className="w-64 max-h-[380px] overflow-y-auto bg-[#18181b] border-[#27272a] text-zinc-200 p-1.5 shadow-2xl sidebar-scrollbar z-[100]"
          >
            <div className="px-2 py-1.5 text-[11px] font-medium text-zinc-400">
              Select Language
            </div>

            <DropdownMenuItem
              onClick={() => onSelectLanguageCode('all')}
              className={cn(
                'flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs',
                selectedLanguageCode === 'all'
                  ? 'bg-white/10 text-white font-medium'
                  : 'hover:bg-white/5 text-zinc-300'
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">🌐</span>
                <div>
                  <div className="font-semibold text-white">All Languages</div>
                  <div className="text-[10px] text-zinc-400">Show all voices (141+)</div>
                </div>
              </div>
              {selectedLanguageCode === 'all' && (
                <Check className="size-3.5 text-white" />
              )}
            </DropdownMenuItem>

            {languagesList.filter((l) => !l.isAuto).map((langItem) => (
              <DropdownMenuItem
                key={langItem.code}
                onClick={() => {
                  onSelectLanguageCode(langItem.code)
                  onSelectLanguageName(langItem.name)
                }}
                className={cn(
                  'flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs',
                  selectedLanguageCode === langItem.code
                    ? 'bg-white/10 text-white font-medium'
                    : 'hover:bg-white/5 text-zinc-300'
                )}
              >
                <div className="flex items-center gap-2.5">
                  {langItem.flag && <span className="text-sm">{langItem.flag}</span>}
                  <div>
                    <div className="font-semibold text-white">{langItem.name}</div>
                    <div className="text-[10px] text-zinc-400">{langItem.nativeName}</div>
                  </div>
                </div>
                {selectedLanguageCode === langItem.code && (
                  <Check className="size-3.5 text-white" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 2. Categories Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Categories
          </span>
          <ChevronDown className="size-3.5 text-zinc-500" />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {CATEGORY_CHIPS.map((cat) => {
            const Icon = cat.icon
            const isSelected = selectedCategories.includes(cat.id)
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onToggleCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer border',
                  isSelected
                    ? 'bg-white/15 border-white/20 text-white font-medium'
                    : 'bg-[#161619] border-[#27272a] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                )}
              >
                <Icon className="size-3 shrink-0" />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Gender Filter Accordion */}
      <div className="border-t border-[#1f1f23] pt-3 space-y-2">
        <button
          type="button"
          onClick={() => setIsGenderExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs text-zinc-300 hover:text-white font-medium cursor-pointer"
        >
          <span>Gender</span>
          {isGenderExpanded ? (
            <ChevronDown className="size-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="size-3.5 text-zinc-500" />
          )}
        </button>

        {isGenderExpanded && (
          <div className="grid grid-cols-3 gap-1 pt-1">
            {(['all', 'female', 'male'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onSelectGender(g)}
                className={cn(
                  'py-1.5 px-2 rounded-lg text-[11px] font-medium capitalize text-center transition-colors cursor-pointer border',
                  selectedGender === g
                    ? 'bg-white/15 border-white/20 text-white'
                    : 'bg-[#161619] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                )}
              >
                {g === 'all' ? 'All' : g === 'female' ? 'Women' : 'Men'}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}



