import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExplorerTab } from './types'

interface VoiceExplorerToolbarProps {
  activeTab: ExplorerTab
  onTabChange: (tab: ExplorerTab) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onClose: () => void
}

export function VoiceExplorerToolbar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onClose,
}: VoiceExplorerToolbarProps) {
  return (
    <div className="p-3.5 px-5 border-b border-[#1f1f23] flex items-center justify-between gap-3 shrink-0">
      {/* Left Tabs: Explore | My Voices */}
      <div className="flex items-center gap-1 bg-[#161619] p-1 rounded-xl border border-[#27272a]">
        <button
          type="button"
          onClick={() => onTabChange('explore')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            activeTab === 'explore'
              ? 'bg-white/15 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          Explore
        </button>
        <button
          type="button"
          onClick={() => onTabChange('my-voices')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            activeTab === 'my-voices'
              ? 'bg-white/15 text-white shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          My voices
        </button>
      </div>

      {/* Right Search Input & Close Button */}
      <div className="flex items-center gap-2 max-w-sm flex-1 justify-end">
        <div className="relative flex-1">
          <Search className="size-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Start typing to search..."
            className="w-full h-9 rounded-xl bg-[#161619] border border-[#27272a] pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close Explorer (Esc)"
          className="size-9 rounded-xl border border-[#27272a] bg-[#161619] hover:bg-[#202024] hover:border-zinc-500 hover:text-white flex items-center justify-center text-zinc-400 transition-colors cursor-pointer shrink-0 shadow-xs"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
