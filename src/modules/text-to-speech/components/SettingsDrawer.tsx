import { motion } from 'framer-motion'
import { ChevronRight, Check, Play } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Slider } from '@/components/ui/slider'
import ExpandableContainer from '@/components/ExpandableContainer'
import { cn } from '@/lib/utils'
import { Voice, LanguageOption, LANGUAGES, useDynamicLanguages } from '../types'

export interface SettingsDrawerProps {
  engine?: 'cosyvoice3' | 'chatterbox'
  onEngineChange?: (engine: 'cosyvoice3' | 'chatterbox') => void
  onSwitchToCosyVoice?: () => void
  activeVoice: Voice
  voices: Voice[]
  selectedVoiceId: string
  focusedRoundNumber?: number
  totalRounds?: number
  playingVoiceId?: string | null
  onTogglePreview?: (voice: Voice, e?: React.MouseEvent) => void
  voicePrompt?: string
  onVoicePromptChange?: (val: string) => void
  stability: number
  similarity: number
  cfgScale: number
  lavaSrEnabled: boolean
  activeLanguage: LanguageOption
  onSelectVoice: (id: string) => void
  onOpenCloneModal: () => void
  onOpenExplorerModal?: () => void
  onStabilityChange: (val: number) => void
  onSimilarityChange: (val: number) => void
  onCfgScaleChange: (val: number) => void
  onToggleLavaSr: () => void
  onSelectLanguage: (lang: string) => void
}

export function SettingsDrawer({
  engine = 'cosyvoice3',
  onEngineChange,
  onSwitchToCosyVoice: _onSwitchToCosyVoice,
  activeVoice,
  voices: _voices,
  selectedVoiceId: _selectedVoiceId,
  focusedRoundNumber,
  totalRounds: _totalRounds,
  playingVoiceId,
  onTogglePreview,
  voicePrompt = '',
  onVoicePromptChange,
  stability,
  similarity,
  cfgScale,
  lavaSrEnabled,
  activeLanguage,
  onSelectVoice: _onSelectVoice,
  onOpenCloneModal,
  onOpenExplorerModal,
  onStabilityChange,
  onSimilarityChange,
  onCfgScaleChange,
  onToggleLavaSr,
  onSelectLanguage,
}: SettingsDrawerProps) {
  const dynamicLanguages = useDynamicLanguages()
  const languagesList = dynamicLanguages.length > 0 ? dynamicLanguages : LANGUAGES

  const cosyVoiceSuggestions = [
    'Whispering softly with quiet emotional tears',
    'Warm, calm, and soothing female voice with gentle pauses',
    'Excited and energetic podcast host with crisp articulation',
    'Authoritative cinematic narrator with deep resonant tone',
    'Furious and breathless, speaking rapidly with high emotion',
    'Robot-like synthesized delivery with steady monotonic cadence',
  ]

  const activeSuggestions = cosyVoiceSuggestions

  return (
    <div className="w-full shrink-0 h-full overflow-y-auto px-4 py-3 space-y-5 pb-28 sidebar-scrollbar">
      {/* VOICE ENGINE SELECTOR */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-300">
          Voice Engine
        </label>
        <div className="relative flex p-0.5 bg-[#141417] border border-[#27272a] rounded-lg">
          <button
            type="button"
            onClick={() => onEngineChange?.('cosyvoice3')}
            className={cn(
              'relative flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer text-center select-none',
              engine === 'cosyvoice3'
                ? 'text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {engine === 'cosyvoice3' && (
              <motion.div
                layoutId="engineTabActive"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute inset-0 bg-[#242429] rounded-md shadow-xs border border-white/5"
              />
            )}
            <span className="relative z-10">CosyVoice 3</span>
          </button>

          <button
            type="button"
            onClick={() => onEngineChange?.('chatterbox')}
            className={cn(
              'relative flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer text-center select-none',
              engine === 'chatterbox'
                ? 'text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {engine === 'chatterbox' && (
              <motion.div
                layoutId="engineTabActive"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute inset-0 bg-[#242429] rounded-md shadow-xs border border-white/5"
              />
            )}
            <span className="relative z-10">Chatterbox T3</span>
          </button>
        </div>
      </div>

      {/* VOICE SELECTION (Both CosyVoice 3 and Chatterbox support voice cloning) */}
      <ExpandableContainer isExpanded={true}>
        <div className="space-y-2.5 pb-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300">
              Voice Selection
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenExplorerModal}
                className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                Browse All
              </button>
              <span className="text-zinc-600">·</span>
              <button
                type="button"
                onClick={onOpenCloneModal}
                className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                Clone Voice
              </button>
            </div>
          </div>

          <div
            onClick={onOpenExplorerModal}
            className="w-full flex items-center justify-between p-2 rounded-xl border border-[#27272a] bg-[#161619] hover:border-zinc-700/80 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {activeVoice.avatarUrl ? (
                <img
                  src={activeVoice.avatarUrl}
                  alt={activeVoice.name}
                  className="size-8 rounded-lg object-cover shrink-0 ring-1 ring-white/10"
                />
              ) : (
                <div
                  className={cn(
                    'size-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 select-none shadow-xs text-white',
                    activeVoice.color || 'bg-blue-600'
                  )}
                >
                  {activeVoice.initials || activeVoice.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-xs text-white truncate">
                    {activeVoice.name}
                  </span>
                  {activeVoice.category === 'cloned' && (
                    <span className="text-[9px] px-1.5 py-0.2 bg-white/10 text-zinc-300 rounded font-medium shrink-0">
                      Cloned
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {activeVoice.description}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              {activeVoice.sampleUrl && onTogglePreview && (
                <button
                  type="button"
                  title={playingVoiceId === activeVoice.id ? 'Pause Voice Sample' : 'Test Voice'}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    onTogglePreview(activeVoice, e)
                  }}
                  className={cn(
                    'size-7 rounded-full flex items-center justify-center transition-all cursor-pointer',
                    playingVoiceId === activeVoice.id
                      ? 'bg-white text-black shadow-sm shadow-white/20'
                      : 'bg-white/[0.08] hover:bg-white/20 text-zinc-300 hover:text-white'
                  )}
                >
                  {playingVoiceId === activeVoice.id ? (
                    <div className="flex items-center gap-0.5">
                      <span className="w-0.5 h-2.5 bg-black rounded-full animate-pulse" />
                      <span className="w-0.5 h-3.5 bg-black rounded-full animate-pulse delay-75" />
                      <span className="w-0.5 h-2 bg-black rounded-full animate-pulse delay-150" />
                    </div>
                  ) : (
                    <Play className="size-3 fill-current ml-0.5" />
                  )}
                </button>
              )}
              <ChevronRight className="size-4 text-zinc-500 group-hover:text-white transition-colors shrink-0" />
            </div>
          </div>
        </div>
      </ExpandableContainer>

      {/* VOICE PROMPT & PERFORMANCE DIRECTION (CosyVoice 3 Instruct Only) */}
      <ExpandableContainer isExpanded={engine === 'cosyvoice3'}>
        <div className="space-y-2.5 rounded-xl border border-[#27272a] bg-[#161619] p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <span>Voice Prompt</span>
              <span className="text-[10px] text-zinc-500 font-normal">
                (Instruction)
              </span>
            </label>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-zinc-300 font-medium">
              {focusedRoundNumber
                ? `Speaker ${focusedRoundNumber}`
                : 'Speaker Prompt'}
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Instruct performance, emotion, whispering, tone, or pacing in natural language.
          </p>

          <div className="relative">
            <textarea
              value={voicePrompt}
              onChange={(e) => onVoicePromptChange?.(e.target.value)}
              rows={3}
              placeholder="e.g. Whispering softly with quiet emotional tears, or A calm authoritative narrator..."
              className="w-full rounded-lg border border-[#27272a] bg-[#111114] px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500/30 resize-none transition-all"
            />
          </div>

          {/* Quick Suggestion Chips with Smooth Entrance */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-zinc-500">
                CosyVoice Instruct Presets:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onVoicePromptChange?.(suggestion)}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-md border transition-all text-left truncate max-w-full cursor-pointer',
                    voicePrompt === suggestion
                      ? 'border-zinc-400 bg-white/10 text-white font-medium'
                      : 'border-white/5 bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:text-zinc-200 hover:bg-white/[0.06]'
                  )}
                >
                  {suggestion.split(' ').slice(0, 3).join(' ')}...
                </button>
              ))}
            </div>
          </div>
        </div>
      </ExpandableContainer>

      {/* VOICE PARAMETERS */}
      <div className="space-y-5 pt-2 border-t border-[#1f1f23]">
        <div className="text-[11px] font-medium text-zinc-400">
          Voice Parameters
        </div>

        {/* Stability / Temperature Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300">Stability (Temperature)</span>
            <span className="font-mono text-zinc-400">{stability.toFixed(2)}</span>
          </div>
          <Slider
            value={[stability * 100]}
            min={10}
            max={150}
            step={1}
            onValueChange={(val) => onStabilityChange((val[0] || 70) / 100)}
          />
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Creative (1.2)</span>
            <span>Robust (0.2)</span>
          </div>
        </div>

        {/* Similarity / Reference Top-P Slider (CosyVoice 3 only) */}
        <ExpandableContainer isExpanded={engine === 'cosyvoice3'}>
          <div className="space-y-2 pb-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300">Cloning Fidelity (Top-P)</span>
              <span className="font-mono text-zinc-400">{similarity.toFixed(2)}</span>
            </div>
            <Slider
              value={[similarity * 100]}
              min={30}
              max={100}
              step={1}
              onValueChange={(val) => onSimilarityChange((val[0] || 85) / 100)}
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Low Variation</span>
              <span>High Precision</span>
            </div>
          </div>
        </ExpandableContainer>

        {/* Emotion / Exaggeration CFG Scale Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300">Emotion Intensity (CFG Scale)</span>
            <span className="font-mono text-zinc-400">{cfgScale.toFixed(1)}</span>
          </div>
          <Slider
            value={[cfgScale * 10]}
            min={10}
            max={30}
            step={1}
            onValueChange={(val) => onCfgScaleChange((val[0] || 15) / 10)}
          />
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Subtle (1.0)</span>
            <span>Standard (1.5)</span>
            <span>Exaggerated (3.0)</span>
          </div>
        </div>

        {/* Studio Voice Clarity Enhancer (CosyVoice 3 only) */}
        <ExpandableContainer isExpanded={engine === 'cosyvoice3'}>
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-xs text-zinc-300">Voice Clarity</div>
              <div className="text-[11px] text-zinc-500">Enhances Speech To 48kHz Ultra HD</div>
            </div>
            <button
              type="button"
              onClick={onToggleLavaSr}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                lavaSrEnabled ? 'bg-white' : 'bg-zinc-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block size-4 transform rounded-full bg-[#0f0f10] shadow ring-0 transition duration-200 ease-in-out',
                  lavaSrEnabled ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </ExpandableContainer>

        {/* Language Selection Dropdown */}
        <div className="flex items-center justify-between py-1">
          <span className="text-xs font-semibold text-zinc-300">Language</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between gap-2 min-w-[150px] h-8.5 rounded-lg border border-[#27272a] bg-[#161619] hover:bg-[#1c1c20] px-2.5 text-xs text-zinc-200 transition-colors cursor-pointer shadow-xs group"
              >
                <div className="flex items-center gap-2 truncate">
                  {!activeLanguage.isAuto && activeLanguage.flag && (
                    <span className="text-sm leading-none shrink-0">{activeLanguage.flag}</span>
                  )}
                  <span className="truncate font-medium">{activeLanguage.name}</span>
                </div>
                <ChevronRight className="size-3.5 text-zinc-500 group-hover:text-zinc-300 shrink-0 ml-1 transition-colors" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-72 max-h-[440px] overflow-y-auto bg-[#18181b] border-[#27272a] text-zinc-200 p-1.5 shadow-2xl sidebar-scrollbar z-[100]"
            >
              <div className="px-2 py-1.5 text-[11px] font-medium text-zinc-400">
                Select Language
              </div>

              {languagesList.map((langItem) => (
                <DropdownMenuItem
                  key={langItem.code}
                  onClick={() => onSelectLanguage(langItem.name)}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs',
                    activeLanguage.name === langItem.name
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
                  {activeLanguage.name === langItem.name && (
                    <Check className="size-3.5 text-white" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
