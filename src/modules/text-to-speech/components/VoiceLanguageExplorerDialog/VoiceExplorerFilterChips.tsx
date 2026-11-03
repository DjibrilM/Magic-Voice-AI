import { X } from 'lucide-react'
import { GenderFilter } from './types'

interface VoiceExplorerFilterChipsProps {
  selectedLanguageCode: string
  onResetLanguage: () => void
  selectedLangObj: { name: string; flag?: string }
  selectedGender: GenderFilter
  onResetGender: () => void
  selectedCategories: string[]
  onRemoveCategory: (category: string) => void
  searchQuery: string
  onResetFilters: () => void
}

export function VoiceExplorerFilterChips({
  selectedLanguageCode,
  onResetLanguage,
  selectedLangObj,
  selectedGender,
  onResetGender,
  selectedCategories,
  onRemoveCategory,
  searchQuery,
  onResetFilters,
}: VoiceExplorerFilterChipsProps) {
  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedGender !== 'all' ||
    selectedLanguageCode !== 'all' ||
    searchQuery.trim().length > 0

  if (!hasActiveFilters) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap pb-2 pt-0.5">
      <span className="text-[11px] text-zinc-500 font-medium">Filters:</span>

      {selectedLanguageCode !== 'all' && (
        <span className="inline-flex items-center gap-1 text-[11px] bg-white/10 border border-white/10 text-white px-2 py-0.5 rounded-full">
          <span>
            {selectedLangObj.flag} {selectedLangObj.name}
          </span>
          <button
            type="button"
            onClick={onResetLanguage}
            className="hover:text-red-400 cursor-pointer ml-0.5"
            title="Remove language filter"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      {selectedGender !== 'all' && (
        <span className="inline-flex items-center gap-1 text-[11px] bg-white/10 border border-white/10 text-white px-2 py-0.5 rounded-full capitalize">
          <span>{selectedGender === 'female' ? 'Women' : selectedGender === 'male' ? 'Men' : selectedGender}</span>
          <button
            type="button"
            onClick={onResetGender}
            className="hover:text-red-400 cursor-pointer ml-0.5"
            title="Remove gender filter"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      {selectedCategories.map((cat) => (
        <span
          key={cat}
          className="inline-flex items-center gap-1 text-[11px] bg-sky-500/15 border border-sky-500/30 text-sky-300 px-2 py-0.5 rounded-full"
        >
          <span>{cat}</span>
          <button
            type="button"
            onClick={() => onRemoveCategory(cat)}
            className="hover:text-white cursor-pointer ml-0.5"
            title={`Remove ${cat}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onResetFilters}
        className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer ml-1"
      >
        Clear all
      </button>
    </div>
  )
}
