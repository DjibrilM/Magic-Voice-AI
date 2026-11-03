import { useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import {
  GripVertical,
  Smile,
  Gauge,
  Trash2,
  ChevronDown,
  Check,
  Play,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ExpandableContainer from '@/components/ExpandableContainer'
import { cn } from '@/lib/utils'
import {
  SpeechRound,
  Voice,
  QvacEmotion,
  QvacPace,
  COSYVOICE_EMOTIONS,
  PARLER_EMOTIONS,
  QVAC_PACES,
  QVAC_PAUSES,
  QVAC_REACTION_CUES,
  QVAC_TONE_CUES,
} from '../types'
import { isLegacyPlaceholderText } from '../store/ttsStore'

export interface DialogueRoundCardProps {
  round: SpeechRound
  index: number
  totalRounds: number
  speaker: Voice
  voices: Voice[]
  isFocused: boolean
  isShuffling: boolean
  playingVoiceId?: string | null
  onTogglePreview?: (voice: Voice, e?: React.MouseEvent) => void
  onFocus: () => void
  onUpdateRound: (updated: Partial<SpeechRound>) => void
  onRemoveRound: () => void
  onOpenCloneModal: () => void
  onOpenExplorerModal?: () => void
  onInsertPauseTag: (tag: string) => void
  engine?: 'cosyvoice3' | 'chatterbox'
  disableEnterAnimation?: boolean
}

export function DialogueRoundCard({
  round,
  index = 0,
  totalRounds,
  speaker,
  voices: _voices,
  isFocused,
  isShuffling,
  playingVoiceId,
  onTogglePreview,
  onFocus,
  onUpdateRound,
  onRemoveRound,
  onOpenCloneModal: _onOpenCloneModal,
  onOpenExplorerModal,
  onInsertPauseTag: _onInsertPauseTag,
  engine = 'cosyvoice3',
  disableEnterAnimation,
}: DialogueRoundCardProps) {
  const isDefaultRound = disableEnterAnimation ?? (round.id === 'round-1' || index === 0)
  const activeEmotions = engine === 'cosyvoice3' ? COSYVOICE_EMOTIONS : PARLER_EMOTIONS
  const dragControls = useDragControls()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Ensure legacy placeholder demo text is wiped immediately
  const currentText = isLegacyPlaceholderText(round.text) ? '' : round.text

  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  // Re-measure on text change (wrapping depends on content)
  useLayoutEffect(() => {
    autoResizeTextarea()
  }, [currentText, autoResizeTextarea])

  // Re-measure on window resize: narrower/wider layout reflows
  // wrapped lines, so scrollHeight goes stale without this.
  // Also observes the card itself so sidebar/panel resizes are caught
  // even when window size doesn't change.
  useEffect(() => {
    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(autoResizeTextarea)
    }
    window.addEventListener('resize', schedule)
    let ro: ResizeObserver | null = null
    const card = textareaRef.current?.closest('[data-speaker-card]') ?? textareaRef.current?.parentElement
    if (card && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule)
      ro.observe(card)
    }
    // Fonts/layout settling after mount can also change wrapping
    const t = setTimeout(autoResizeTextarea, 100)
    return () => {
      window.removeEventListener('resize', schedule)
      ro?.disconnect()
      clearTimeout(t)
      cancelAnimationFrame(raf)
    }
  }, [autoResizeTextarea])

  useEffect(() => {
    if (isLegacyPlaceholderText(round.text)) {
      onUpdateRound({ text: '' })
    }
  }, [round.text, onUpdateRound])

  const insertTagAtCursor = useCallback(
    (openTag: string, closeTag?: string) => {
      onFocus()
      const el = textareaRef.current
      const raw = isLegacyPlaceholderText(round.text) ? '' : round.text

      if (!el) {
        const next = raw.trimEnd()
          ? `${raw.trimEnd()} ${openTag}${closeTag ? closeTag : ''} `
          : `${openTag}${closeTag ? closeTag : ''} `
        onUpdateRound({ text: next })
        return
      }

      const start = el.selectionStart ?? raw.length
      const end = el.selectionEnd ?? raw.length
      const hasSelection = start !== end
      const selectedText = raw.substring(start, end)

      let newText = ''
      let cursorTarget = start

      const isReactionCue = ['[hmm]'].includes(openTag)

      if (closeTag && hasSelection) {
        // Wraps highlighted text cleanly: e.g. [whisper]selected text[/whisper]
        const wrapped = `${openTag}${selectedText}${closeTag}`
        newText = raw.substring(0, start) + wrapped + raw.substring(end)
        cursorTarget = start + wrapped.length
      } else if (closeTag && !isReactionCue) {
        // Tone wrapper with no selection: inserts [whisper][/whisper] and places cursor inside: [whisper]|[/whisper]
        const insertion = `${openTag}${closeTag}`
        newText = raw.substring(0, start) + insertion + raw.substring(end)
        cursorTarget = start + openTag.length
      } else {
        // Single cue like [hmm] or [pause 0.5s]
        const before = raw.substring(0, start)
        const after = raw.substring(end)
        const prefix = before.length > 0 && !/\s$/.test(before) ? ' ' : ''
        const suffix = after.length > 0 && !/^\s/.test(after) ? ' ' : ' '
        const insertion = `${prefix}${openTag}${suffix}`
        newText = before + insertion + after
        cursorTarget = start + insertion.length
      }

      onUpdateRound({ text: newText })

      // Restore focus and precise cursor position cleanly
      requestAnimationFrame(() => {
        if (el) {
          el.focus()
          el.setSelectionRange(cursorTarget, cursorTarget)
          autoResizeTextarea()
        }
      })
    },
    [round.text, onFocus, onUpdateRound, autoResizeTextarea]
  )

  return (
    <Reorder.Item
      as="div"
      key={round.id}
      value={round}
      dragListener={false}
      dragControls={dragControls}
      layout="position"
      initial={isDefaultRound ? false : { opacity: 0, y: 24, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: isShuffling
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
          : isFocused
            ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
            : 'none',
        zIndex: isShuffling ? 50 : 1,
      }}
      exit={{
        opacity: 0,
        scale: 0.95,
        y: -12,
        transition: {
          duration: 0.2,
          ease: 'easeInOut',
        },
      }}
      whileDrag={{
        scale: 1,
        rotate: 0,
        boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.15)',
        cursor: 'grabbing',
        zIndex: 50,
      }}
      transition={{
        type: 'spring',
        stiffness: 350,
        damping: 30,
        opacity: { duration: 0.25 },
      }}
      onClick={onFocus}
      data-speaker-card
      className={cn(
        'group relative flex flex-col w-full rounded-2xl border transition-colors duration-150 overflow-hidden bg-[#141416]',
        isFocused && !isShuffling
          ? 'border-zinc-700/80 bg-[#151518] shadow-xl ring-1 ring-white/10'
          : !isShuffling && 'border-[#232328] hover:border-zinc-700/60'
      )}
    >
      {/* Speaker Badge & Controls Header (Draggable handle bar) */}
      <div
        onPointerDown={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('button, [role="button"], [role="menuitem"], textarea, input')) {
            return
          }
          dragControls.start(e)
        }}
        style={{ touchAction: 'none' }}
        className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e1e24] px-4 py-3 bg-[#18181b]/40 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Drag Grip Handle */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation()
              dragControls.start(e)
            }}
            style={{ touchAction: 'none' }}
            className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-white rounded cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors select-none"
            title="Drag to reposition dialogue turn"
          >
            <GripVertical className="size-4" />
          </div>

          {/* Voice Selection Pill */}
          <ExpandableContainer isExpanded={true}>
            <div className="flex items-center gap-1.5 pr-1">
              <button
                type="button"
                onClick={() => {
                  onFocus()
                  onOpenExplorerModal?.()
                }}
                className="flex items-center gap-2 rounded-lg bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-zinc-500 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors shadow-xs cursor-pointer group"
                title="Change Voice & Language in Explorer"
              >
                <img
                  src={speaker.avatarUrl || '/voices/sterling.jpg'}
                  alt={speaker.name}
                  className="size-5 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                />
                <span className="font-semibold text-white tracking-tight group-hover:text-white">
                  {speaker.name}
                </span>
                <span className="hidden sm:inline text-zinc-400 font-normal truncate max-w-[140px]">
                  — {speaker.description}
                </span>
                {speaker.languageName && (
                  <span className="hidden md:inline-block text-[10px] text-zinc-400 bg-white/[0.06] border border-white/10 px-1.5 py-0.2 rounded font-normal">
                    {speaker.languageName}
                  </span>
                )}
                {speaker.category === 'cloned' && (
                  <span className="rounded border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                    Custom
                  </span>
                )}
                <ChevronDown className="size-3 text-zinc-500 group-hover:text-zinc-300 ml-0.5 shrink-0" />
              </button>

              {/* Quick Test Voice Play Button on Card Header */}
              {speaker.sampleUrl && onTogglePreview && (
                <button
                  type="button"
                  title={playingVoiceId === speaker.id ? 'Pause Voice Sample' : `Test ${speaker.name}'s Voice`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onFocus()
                    onTogglePreview(speaker, e)
                  }}
                  className={cn(
                    'size-7 rounded-full flex items-center justify-center transition-all cursor-pointer border',
                    playingVoiceId === speaker.id
                      ? 'bg-white text-black border-white shadow-sm shadow-white/20'
                      : 'bg-[#18181b] hover:bg-[#222226] border-[#27272a] text-zinc-400 hover:text-white'
                  )}
                >
                  {playingVoiceId === speaker.id ? (
                    <div className="flex items-center gap-0.5">
                      <span className="w-0.5 h-2.5 bg-black rounded-full animate-pulse" />
                      <span className="w-0.5 h-3 bg-black rounded-full animate-pulse delay-75" />
                      <span className="w-0.5 h-2 bg-black rounded-full animate-pulse delay-150" />
                    </div>
                  ) : (
                    <Play className="size-3 fill-current ml-0.5" />
                  )}
                </button>
              )}
            </div>
          </ExpandableContainer>

          {/* QVAC Emotion Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={onFocus}
                className="flex items-center gap-1.5 rounded-lg bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <Smile className="size-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-500 font-normal">Emotion:</span>
                <span className="font-semibold text-white">{round.emotion || 'Neutral'}</span>
                <ChevronDown className="size-3 text-zinc-500 shrink-0 ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-60 bg-[#18181b] border-[#27272a] text-zinc-200 p-1.5 shadow-2xl"
            >
              <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-medium text-zinc-400 border-b border-[#27272a] mb-1">
                <span>Voice Emotion</span>
                <span className="text-[9px] text-zinc-500 font-mono">
                  {engine === 'cosyvoice3' ? 'CosyVoice 3 (4)' : 'Chatterbox T3'}
                </span>
              </div>
              {activeEmotions.map((e) => (
                <DropdownMenuItem
                  key={e.label}
                  onClick={() => {
                    onFocus()
                    onUpdateRound({ emotion: e.label as QvacEmotion })
                  }}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs',
                    (round.emotion || 'Neutral') === e.label
                      ? 'bg-white/10 text-white font-medium'
                      : 'hover:bg-white/5 text-zinc-300'
                  )}
                >
                  <div>
                    <div className="font-medium">{e.label}</div>
                    <div className="text-[10px] text-zinc-500">{e.description}</div>
                  </div>
                  {(round.emotion || 'Neutral') === e.label && (
                    <Check className="size-3.5 text-white shrink-0 ml-2" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* QVAC Pace Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={onFocus}
                className="flex items-center gap-1.5 rounded-lg bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <Gauge className="size-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-500 font-normal">Pace:</span>
                <span className="font-semibold text-white">{round.pace || 'Moderate'}</span>
                <ChevronDown className="size-3 text-zinc-500 shrink-0 ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 bg-[#18181b] border-[#27272a] text-zinc-200 p-1.5 shadow-2xl"
            >
              <div className="px-2 py-1.5 text-[11px] font-medium text-zinc-400">
                Speech Cadence
              </div>
              {QVAC_PACES.map((p) => (
                <DropdownMenuItem
                  key={p.label}
                  onClick={() => {
                    onFocus()
                    onUpdateRound({ pace: p.label as QvacPace })
                  }}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs',
                    (round.pace || 'Moderate') === p.label
                      ? 'bg-white/10 text-white font-medium'
                      : 'hover:bg-white/5 text-zinc-300'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({p.rate})</span>
                  </div>
                  {(round.pace || 'Moderate') === p.label && (
                    <Check className="size-3.5 text-white shrink-0 ml-2" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Delete Round Button */}
        {totalRounds > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveRound()
            }}
            className="rounded p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer ml-auto"
            title="Remove speaker turn"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* Main Textarea Area */}
      <div className="p-4">
        <textarea
          value={currentText}
          onFocus={onFocus}
          onPointerDown={(e) => {
            e.stopPropagation()
            onFocus()
          }}
          onChange={(e) => {
            const nextVal = isLegacyPlaceholderText(e.target.value) ? '' : e.target.value
            onUpdateRound({ text: nextVal })
            autoResizeTextarea()
          }}
          className="w-full bg-transparent text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none font-normal overflow-hidden min-h-[5rem]"
          ref={textareaRef}
          placeholder={`Enter dialogue or speech for ${speaker.name}...`}
        />
      </div>

      {/* Card Footer Toolbar: Insert Pauses & Vocal Reactions */}
      <div className="flex items-center justify-between border-t border-[#1e1e24] bg-[#121214]/60 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Reaction Cues */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 font-medium mr-0.5">
              Cues:
            </span>
            {QVAC_REACTION_CUES.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  insertTagAtCursor(item.tag)
                }}
                className="rounded-md bg-white/[0.04] hover:bg-white/[0.08] hover:text-white border border-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-zinc-400 transition-colors cursor-pointer"
              >
                +{item.label}
              </button>
            ))}
          </div>

          <div className="h-3 w-px bg-zinc-800 hidden sm:block" />

          {/* Pause Cues */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 font-medium mr-0.5">
              Pause:
            </span>
            {QVAC_PAUSES.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  insertTagAtCursor(item.tag)
                }}
                className="rounded-md bg-white/[0.04] hover:bg-white/[0.08] hover:text-white border border-white/[0.08] px-2 py-0.5 text-[11px] font-mono text-zinc-400 transition-colors cursor-pointer"
              >
                +{item.label}
              </button>
            ))}
          </div>

          <div className="h-3 w-px bg-zinc-800 hidden sm:block" />

          {/* Tone & Pitch Manipulation */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 font-medium mr-0.5">
              Tone:
            </span>
            {QVAC_TONE_CUES.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  insertTagAtCursor(item.tag, item.closeTag)
                }}
                className="rounded-md bg-white/[0.04] hover:bg-white/[0.08] hover:text-amber-300 border border-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-amber-400/80 transition-colors cursor-pointer"
                title={item.description}
              >
                +{item.label}
              </button>
            ))}
          </div>

          {currentText.includes('[pause') && (
            <span className="ml-1 inline-flex items-center gap-1 rounded bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
              {currentText.match(/\[pause\s*[^\]]+\]/g)?.length || 0} pause cue(s)
            </span>
          )}
        </div>
      </div>
    </Reorder.Item>
  )
}
