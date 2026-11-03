export interface TopSubHeaderProps {
  totalRounds: number
  engine?: 'cosyvoice3' | 'chatterbox'
  onEngineChange?: (engine: 'cosyvoice3' | 'chatterbox') => void
}

export function TopSubHeader({ totalRounds, engine = 'cosyvoice3', onEngineChange }: TopSubHeaderProps) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#1f1f23] px-6">
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-medium text-zinc-400">Dialogue Script</span>
        <span className="text-zinc-600 text-xs">•</span>
        <button
          type="button"
          onClick={() => onEngineChange?.(engine === 'cosyvoice3' ? 'chatterbox' : 'cosyvoice3')}
          className="flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#161619] hover:bg-[#1e1e22] text-zinc-300 hover:text-zinc-100 border border-[#27272a] hover:border-zinc-700 transition-colors cursor-pointer select-none"
          title="Click to toggle between CosyVoice 3 and Chatterbox T3"
        >
          <span>{engine === 'cosyvoice3' ? 'CosyVoice 3' : 'Chatterbox T3'}</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>Rounds:</span>
          <span className="font-semibold text-zinc-300">
            {totalRounds} {totalRounds === 1 ? 'Speaker' : 'Speakers'}
          </span>
        </div>
      </div>
    </div>
  )
}
