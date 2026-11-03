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
  /** Trigger automated emotion/pace tag detection based on script sentiment */
  onAutoTag: () => void
  /** Clear the editor and start fresh */
  onClear: () => void
  /** Trigger speech generation */
  onGenerate: () => void
}

/**
 * Bottom action bar for dialogue script editor.
 * Houses script character statistics, auto-tagging action, and the primary Generate Speech button.
 */
export function SpeechEditorActionBar({
  totalCharacters,
  isSynthesizing,
  modelsReady,
  hasMediaPlayer = false,
  onAutoTag,
  onClear,
  onGenerate,
}: SpeechEditorActionBarProps) {

  return (
    <div
      className={cn(
        'absolute left-0 right-0 z-10 flex items-center justify-between border-t border-[#1f1f23] bg-[#0f0f10]/95 px-6 py-1.5 backdrop-blur-md transition-all duration-200',
        hasMediaPlayer ? 'bottom-15' : 'bottom-0'
      )}
    >
      <div />

      {/* Right action group: Counter, Auto-tag, Generate speech */}
      <div className="flex justify-between w-full items-center gap-3">
        <span className="text-xs text-zinc-400 font-mono">
          <NumberFlow value={totalCharacters} /> / 4,096 Characters
        </span>


        <div className="gap-3.5 flex">
          {/* Clear editor button */}
          <Button
            type="button"
            variant="outline"
            disabled={isSynthesizing}
            onClick={onClear}
            className="border-zinc-700 bg-white/[0.04] hover:bg-white/[0.08] hover:border-zinc-500 text-zinc-200 cursor-pointer shadow-xs font-semibold text-xs gap-1.5 h-8"
            title="Clear all dialogue text and the current generation to start fresh"
          >
            <span>Clear</span>
          </Button>

          {/* Auto-tag button */}
          <Button
            type="button"
            variant="outline"
            onClick={onAutoTag}
            className="border-zinc-700 bg-white/[0.04] hover:bg-white/[0.08] hover:border-zinc-500 text-zinc-200 cursor-pointer shadow-xs font-semibold text-xs gap-1.5 h-8"
            title="Automatically detect prosody tags (emotion, pace) based on punctuation and dialogue context"
          >
            <span>Auto-Tag</span>
          </Button>

          {/* Primary Generate speech button: clean text without icon */}
          <Button
            type="button"
            disabled={isSynthesizing || totalCharacters === 0 || !modelsReady}
            onClick={onGenerate}
            className={cn(
              'cursor-pointer h-8 shadow-md font-semibold text-xs',
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
    </div>
  )
}
