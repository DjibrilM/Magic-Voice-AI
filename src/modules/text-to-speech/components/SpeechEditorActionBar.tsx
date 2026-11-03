import { Button } from '@/components/ui/button'
import NumberFlow from '@number-flow/react'
import { ShimmeringText } from '@/components/ui/shimmering-text'
import { cn } from '@/lib/utils'

export interface SpeechEditorActionBarProps {
  /** Total characters across active speech rounds */
  totalCharacters: number
  /** Total count of speaker dialogue rounds */
  totalRounds?: number
  /** Whether speech synthesis is in progress */
  isSynthesizing: boolean
  /** Whether all required voice engine models are downloaded/ready */
  modelsReady: boolean
  /** Whether the persistent bottom audio player is rendered */
  hasMediaPlayer?: boolean
  /** Trigger automated emotion/pace tag detection based on script sentiment (optional/deprecated) */
  onAutoTag?: () => void
  /** Clear the editor and start fresh */
  onClear: () => void
  /** Trigger speech generation */
  onGenerate: () => void
}

/**
 * Bottom action bar for dialogue script editor.
 * Houses script character statistics and the primary Generate Speech button.
 */
export function SpeechEditorActionBar({
  totalCharacters,
  isSynthesizing,
  modelsReady,
  hasMediaPlayer = false,
  onClear,
  onGenerate,
}: SpeechEditorActionBarProps) {
  return (
    <div
      className={cn(
        'absolute left-0 right-0 z-10 flex h-[46px] items-center justify-between border-t border-[#262629] bg-[#0f0f10]/95 px-6 backdrop-blur-md transition-all duration-200 select-none',
        hasMediaPlayer ? 'bottom-15' : 'bottom-0'
      )}
    >
      {/* Total characters statistics */}
      <div className="flex items-center">
        <span className="text-xs text-zinc-400 font-mono tracking-tight">
          <NumberFlow value={totalCharacters} /> / 4,096 Characters
        </span>
      </div>

      {/* Action buttons: Clear & Generate speech */}
      <div className="flex items-center gap-2.5">
        <Button
          type="button"
          variant="outline"
          disabled={isSynthesizing}
          onClick={onClear}
          className="border-zinc-800 bg-white/[0.04] hover:bg-white/[0.08] hover:border-zinc-600 text-zinc-300 cursor-pointer shadow-xs font-medium text-xs px-3 h-7.5"
          title="Clear all dialogue text and the current generation to start fresh"
        >
          <span>Clear</span>
        </Button>

        <Button
          type="button"
          disabled={isSynthesizing || totalCharacters === 0 || !modelsReady}
          onClick={onGenerate}
          className={cn(
            'cursor-pointer h-7.5 px-3.5 shadow-md font-semibold text-xs',
            isSynthesizing && 'opacity-90',
            !modelsReady && 'opacity-50'
          )}
          title={
            !modelsReady
              ? 'Required voice engine models are not downloaded. Install them first.'
              : isSynthesizing
                ? 'Synthesis in progress'
                : totalCharacters === 0
                  ? 'Enter some text to generate speech'
                  : 'Generate speech'
          }
        >
          {isSynthesizing ? (
            <ShimmeringText
              text="Synthesizing..."
              startOnView={false}
              duration={1.5}
              className="text-black font-semibold text-xs"
            />
          ) : (
            'Generate Speech'
          )}
        </Button>
      </div>
    </div>
  )
}
