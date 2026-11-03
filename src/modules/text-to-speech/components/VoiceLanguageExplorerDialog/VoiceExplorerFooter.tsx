import { Button } from '@/components/ui/button'

interface VoiceExplorerFooterProps {
  totalCount: number
  filteredCount: number
  isFilteredByLanguage: boolean
  languageName: string
  onClose: () => void
  onOpenCloneModal?: () => void
}

export function VoiceExplorerFooter({
  totalCount,
  filteredCount,
  isFilteredByLanguage,
  languageName,
  onClose,
  onOpenCloneModal,
}: VoiceExplorerFooterProps) {
  return (
    <div className="p-3 px-5 border-t border-[#1f1f23] flex items-center justify-between text-xs text-zinc-400 shrink-0 bg-[#0c0c0e]">
      <div className="flex items-center gap-2">
        <span>
          Showing <strong className="text-white">{filteredCount}</strong> of{' '}
          {totalCount} voices
        </span>
        {isFilteredByLanguage && (
          <span className="text-zinc-500">• Filtered by {languageName}</span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {onOpenCloneModal && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              onClose()
              onOpenCloneModal()
            }}
            className="text-xs h-8 px-3 rounded-lg border-zinc-700 hover:bg-white/10 text-zinc-200"
          >
            + Clone Voice
          </Button>
        )}

        <Button
          size="xs"
          onClick={onClose}
          className="text-xs h-8 px-4 rounded-lg bg-white hover:bg-zinc-200 text-black font-medium"
        >
          Done
        </Button>
      </div>
    </div>
  )
}
