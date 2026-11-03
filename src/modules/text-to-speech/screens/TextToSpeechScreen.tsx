import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Play, Pause, Download } from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup, Reorder } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { TrackWavePlayer } from '@/components/player/TrackWavePlayer'
import { ShimmeringText } from '@/components/ui/shimmering-text'
import { deleteAllModels, useModels } from '@/modules/models'
import { usePlayer } from '@/hooks/usePlayer'
import { useAudioEffect } from '@/hooks/useAudioEffect'
import { cn } from '@/lib/utils'

import { Voice, SpeechRound, Generation, HistoryEntry, LANGUAGES, getVoicesForLanguage } from '../types'
import { scanVoiceSamples, loadVoicesForLanguage, deleteCustomVoice } from '@/lib/services/voiceLoader'
import {
  autoTagSpeechRounds,
  formatTime,
  generateSpeech,
} from '../services/tts-service'
import {
  saveAudioToCache,
  getAudioFromCache,
  deleteAudioFromCache,
} from '../services/audioCache'
import { dbService } from '@/lib/services/dbService'
import { useTextToSpeechState } from '../hooks/useTextToSpeechState'
import { useVoiceCloneRecording } from '../hooks/useVoiceCloneRecording'
import { useVoicePreview } from '../hooks/useVoicePreview'
import { useIpcEffect } from '@/hooks/useIpcEffect'
import type { PlayerTrack } from '@/store/playerStore'

import { TopSubHeader } from '../components/TopSubHeader'
import { DialogueRoundCard } from '../components/DialogueRoundCard'
import { SpeechEditorActionBar } from '../components/SpeechEditorActionBar'
import { SettingsDrawer } from '../components/SettingsDrawer'
import { HistoryDrawer } from '../components/HistoryDrawer'
import { VoiceCloneModal } from '../components/VoiceCloneModal'
import { VoiceLanguageExplorerDialog } from '../components/VoiceLanguageExplorerDialog/index'
import { InstallRequiredModelsView } from '../components/InstallRequiredModelsView'

export function TextToSpeechScreen() {
  const [state, updateState] = useTextToSpeechState()
  const [loadedHistoryId, setLoadedHistoryId] = useState<string | null>(null)
  const { allRequiredReady, selectedEngine, setSelectedEngine } = useModels()
  const player = usePlayer()
  const recording = useVoiceCloneRecording({ state, updateState })
  const voicePreview = useVoicePreview()

  // Build a global-player track from a TTS generation so the app-wide audio player can render/play it
  const buildTrackFromGeneration = useCallback(
    (gen: Generation): PlayerTrack => ({
      id: gen.id,
      title: gen.title,
      subtitle: gen.speakerName,
      artist: gen.speakerName,
      audioUrl: gen.audioUrl,
      duration: gen.duration || 8,
      waveform: gen.waveform && gen.waveform.length > 0 ? gen.waveform : [],
    }),
    []
  )

  // Mirror the single global audio element's state back into the TTS screen so the
  // generation card + history drawer stay highlighted while only the global player plays
  useAudioEffect({
    onTimeUpdate: (time, dur) => {
      updateState({
        currentTime: time,
        playbackProgress: dur > 0 ? Math.min(1, time / dur) : 0,
      })
    },
    onStateChange: (playing) => {
      updateState({
        isPlaying: playing,
        ...(!playing ? { playingHistoryId: null } : {}),
      })
    },
  })

  // Real-time IPC Event Gateway listener for incoming generation progress and logs
  useIpcEffect({
    onTtsProgress: (data) => {
      updateState({ synthesisProgress: data.message })
    },
    onTerminalLog: (log) => {
      console.log(`[IPC Terminal ${log.stream}]:`, log.text)
    },
  })

  // Dynamically analyze the voices/samples folder and load initial language voices
  useEffect(() => {
    scanVoiceSamples()
    loadVoicesForLanguage(state.language).then((loaded) => {
      const custom = state.customVoices || []
      const customIds = new Set(custom.map((v) => v.id))
      const combined = [...custom, ...loaded.filter((v) => !customIds.has(v.id))]
      if (combined.length > 0) {
        updateState({
          voices: combined,
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ensure persisted custom voices are immediately in voices list
  useEffect(() => {
    if (state.customVoices && state.customVoices.length > 0 && state.voices.length === 0) {
      updateState({ voices: state.customVoices })
    }
  }, [state.customVoices, state.voices.length, updateState])

  // Load persisted history from SQLite database and hydrate audio on mount
  useEffect(() => {
    let active = true
    const loadSavedHistory = async () => {
      try {
        const saved = await dbService.getSavedConversations()
        const initialItems = saved && saved.length > 0 ? saved : (state.history || [])
        if (initialItems.length === 0) return

        const hydrated = await Promise.all(
          initialItems.map(async (h) => {
            if (h.audioUrl) return h
            const cached = await getAudioFromCache(h.id)
            return cached ? { ...h, audioUrl: cached } : h
          })
        )

        if (active && hydrated.length > 0) {
          updateState({ history: hydrated })
        }
      } catch (err) {
        console.error('[TTS Screen] Error loading conversations from SQLite:', err)
      }
    }
    loadSavedHistory()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Parse "MM:SS" or "M:SS" string to seconds
  const parseDurationStringToSec = useCallback((durationStr?: string): number => {
    if (!durationStr) return 8
    const parts = durationStr.split(':')
    if (parts.length === 2) {
      const min = parseInt(parts[0], 10) || 0
      const sec = parseFloat(parts[1]) || 0
      return min * 60 + sec
    }
    return 8
  }, [])

  // Download a data: URI (base64-encoded audio) as a .wav file.
  // Converts the base64 payload directly to a Blob so the download is reliable in Electron.
  // Using fetch() on data URIs can be inconsistent in Electron; direct base64 decode avoids that.
  const downloadDataUriAsWav = useCallback(
    (dataUri: string, fileName: string) => {
      try {
        const base64 = dataUri.split(',')[1]
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: 'audio/wav' })
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(objectUrl)
      } catch (err) {
        console.error('[TTS Screen] Download failed:', err)
        // Fallback: direct data URI download
        const a = document.createElement('a')
        a.href = dataUri
        a.download = fileName
        a.click()
      }
    },
    []
  )

  const handleTogglePlay = useCallback(() => {
    voicePreview.stopPreview()
    const gen = state.activeGeneration || state.generations[0]
    if (!gen || !gen.audioUrl) return
    // Route all TTS playback through the single global audio player
    if (player.currentTrack?.id === gen.id) {
      player.togglePlay()
    } else {
      player.play(buildTrackFromGeneration(gen))
    }
    updateState({ activeGeneration: gen, playingHistoryId: null })
  }, [player, state.activeGeneration, state.generations, buildTrackFromGeneration, voicePreview, updateState])

  const handleVoicesLoaded = useCallback(
    (loadedVoices: Voice[]) => {
      const custom = state.customVoices || []
      const customIds = new Set(custom.map((v) => v.id))
      const combined = [...custom, ...loadedVoices.filter((v) => !customIds.has(v.id))]
      updateState({
        voices: combined,
      })
    },
    [state.customVoices, updateState]
  )

  // Total character counter
  const totalCharacters = useMemo(() => {
    return state.rounds.reduce((sum, r) => sum + r.text.length, 0)
  }, [state.rounds])

  // Get voice helper
  const getVoice = useCallback(
    (id: string): Voice => {
      return (
        state.voices.find((v) => v.id === id) || {
          id: 'voice-custom',
          name: 'Speaker',
          description: 'Custom Voice',
          category: 'preset',
          color: '#a855f7',
          avatarUrl: '/voices/sterling.jpg',
          sampleUrl: '/voices/samples/en/voice_en_male_1.mp3',
          initials: 'S',
          gender: 'Neutral',
          tags: [],
        }
      )
    },
    [state.voices]
  )

  // Focused round
  const focusedRound = state.rounds[state.focusedRoundIndex] || state.rounds[0]

  const activeVoice = useMemo(
    () => getVoice(focusedRound?.voiceId || state.selectedVoiceId),
    [focusedRound?.voiceId, state.selectedVoiceId, getVoice]
  )

  const activeLanguage = useMemo(
    () => LANGUAGES.find((l) => l.name === state.language) || LANGUAGES[0],
    [state.language]
  )

  // Generation that the TTS screen surfaces (latest or loaded history entry)
  const currentGeneration = state.activeGeneration || state.generations[0] || null
  const isGenerationPlaying = Boolean(
    currentGeneration && player.currentTrack?.id === currentGeneration.id && player.isPlaying
  )

  const handleSaveVoice = useCallback(
    (newVoice: Voice) => {
      const targetIndex =
        state.focusedRoundIndex >= 0 && state.focusedRoundIndex < state.rounds.length
          ? state.focusedRoundIndex
          : 0
      const currentCustom = state.customVoices || []
      const updatedCustom = [newVoice, ...currentCustom.filter((v) => v.id !== newVoice.id)]
      const updatedVoices = [newVoice, ...state.voices.filter((v) => v.id !== newVoice.id)]
      updateState({
        customVoices: updatedCustom,
        voices: updatedVoices,
        selectedVoiceId: newVoice.id,
        rounds: state.rounds.map((r, i) =>
          i === targetIndex ? { ...r, voiceId: newVoice.id } : r
        ),
      })
    },
    [state.focusedRoundIndex, state.rounds, state.customVoices, state.voices, updateState]
  )

  const handleDeleteCustomVoice = useCallback(
    async (voiceId: string) => {
      try {
        await deleteCustomVoice(voiceId)
      } catch (err) {
        console.error('Failed to delete custom voice files:', err)
      }
      const updatedCustom = (state.customVoices || []).filter((v) => v.id !== voiceId)
      const updatedVoices = state.voices.filter((v) => v.id !== voiceId)
      const fallbackVoiceId = updatedVoices[0]?.id || 'voice-en-male-1'
      updateState({
        customVoices: updatedCustom,
        voices: updatedVoices,
        selectedVoiceId: state.selectedVoiceId === voiceId ? fallbackVoiceId : state.selectedVoiceId,
        rounds: state.rounds.map((r) =>
          r.voiceId === voiceId ? { ...r, voiceId: fallbackVoiceId } : r
        ),
      })
    },
    [state.customVoices, state.voices, state.selectedVoiceId, state.rounds, updateState]
  )

  // Add a new speaker dialogue round
  const handleAddSpeakerRound = () => {
    const currentVoiceIndex = state.voices.findIndex(
      (v) => v.id === state.rounds[state.rounds.length - 1]?.voiceId
    )
    const nextVoice = state.voices[(currentVoiceIndex + 1) % state.voices.length] || state.voices[0]

    const newRound: SpeechRound = {
      id: `round-${Date.now()}`,
      voiceId: nextVoice.id,
      text: '',
      speed: 1.0,
      emotion: 'Neutral',
      pace: 'Moderate',
    }

    updateState({
      rounds: [...state.rounds, newRound],
      focusedRoundIndex: state.rounds.length,
      selectedVoiceId: nextVoice.id,
    })
  }

  // Remove a speech round
  const handleRemoveRound = (roundId: string) => {
    if (state.rounds.length <= 1) return
    const remainingRounds = state.rounds.filter((r) => r.id !== roundId)
    const nextIndex = Math.min(state.focusedRoundIndex, remainingRounds.length - 1)
    const nextVoiceId =
      remainingRounds[nextIndex]?.voiceId || remainingRounds[0]?.voiceId || state.selectedVoiceId
    updateState({
      rounds: remainingRounds,
      focusedRoundIndex: nextIndex,
      selectedVoiceId: nextVoiceId,
    })
  }

  // Insert pause tag
  const handleInsertPauseTag = (tag: string, roundIdx: number) => {
    updateState({
      rounds: state.rounds.map((r, i) => {
        if (i !== roundIdx) return r
        const trimmed = r.text.trimEnd()
        const newText = trimmed ? `${trimmed} ${tag} ` : `${tag} `
        return { ...r, text: newText }
      }),
    })
  }

  // Auto-tag function
  const handleAutoTag = () => {
    updateState({ rounds: autoTagSpeechRounds(state.rounds) })
  }

  // Clear the editor: reset to a single empty turn and drop the current generation/playback
  const handleClearEditor = () => {
    if (state.isSynthesizing) return
    voicePreview.stopPreview()
    player.pause()
    const voiceId = state.rounds[0]?.voiceId || state.selectedVoiceId
    updateState({
      rounds: [
        {
          id: `round-${Date.now()}`,
          voiceId,
          text: '',
          speed: 1.0,
          emotion: 'Neutral',
          pace: 'Moderate',
        },
      ],
      focusedRoundIndex: 0,
      selectedVoiceId: voiceId,
      generations: [],
      activeGeneration: null,
      isPlaying: false,
      playbackProgress: 0,
      currentTime: 0,
      seekTarget: null,
      playingHistoryId: null,
      synthesisProgress: '',
    })
  }

  // Generate speech handler - Wired directly to Electron Core Backend IPC
  const handleGenerateSpeech = async () => {
    if (state.isSynthesizing || totalCharacters === 0 || !allRequiredReady) return

    // Immediately stop voice audition previews and clear previous playback
    voicePreview.stopPreview()
    player.pause()
    const currentEngine = state.engine || selectedEngine || 'cosyvoice3'
    updateState({
      isSynthesizing: true,
      synthesisProgress: `Connecting to ${currentEngine === 'chatterbox' ? 'Chatterbox T3' : 'CosyVoice 3'} voice engine...`,
    })

    // Filter active speech rounds that have text to synthesize
    const activeRounds = state.rounds.filter((r) => r.text.trim().length > 0)
    if (activeRounds.length === 0) {
      updateState({ isSynthesizing: false, synthesisProgress: '' })
      return
    }

    const firstSpeaker = getVoice(activeRounds[0]?.voiceId || state.rounds[0].voiceId)
    const taskId = `task-${Date.now()}`

    const mappedRounds = activeRounds.map((r) => {
      const spk = getVoice(r.voiceId)
      return {
        ...r,
        referenceAudioSrc: spk.sampleUrl || spk.referenceAudioName,
        speakerName: spk.name,
        speakerColor: spk.color,
        description: r.description || spk.description,
      }
    })

    try {
      const ipcResult = await generateSpeech({
        taskId,
        rounds: mappedRounds,
        speakerName: activeRounds.length > 1 ? `${activeRounds.length} Speakers` : firstSpeaker.name,
        speakerColor: activeRounds.length > 1 ? '#10b981' : firstSpeaker.color,
        speakerAvatarUrl: firstSpeaker.avatarUrl || '/voices/sterling.jpg',
        referenceAudioSrc: firstSpeaker.sampleUrl || firstSpeaker.referenceAudioName,
        language: state.language || 'en',
        prompt: state.voicePrompt,
        voicePrompt: state.voicePrompt,
        stability: state.stability,
        similarity: state.similarity,
        cfgScale: state.cfgScale,
        lavaSrEnabled: state.lavaSrEnabled,
        speed: state.speed,
        historyIndex: state.history.length,
        engine: currentEngine,
      })

      if (ipcResult.success && ipcResult.data) {
        const newGen: Generation = {
          ...(ipcResult.data as Generation),
          emotion: ipcResult.data.emotion || activeRounds[0]?.emotion || 'Neutral',
        }

        const now = Date.now()
        const speakerNames = Array.from(
          new Set(
            activeRounds.map((r) => {
              const spk = getVoice(r.voiceId)
              return spk.name || 'Speaker'
            })
          )
        )
        const voiceSummary =
          speakerNames.length > 1
            ? `${speakerNames.length} Speakers (${speakerNames.slice(0, 3).join(', ')}${speakerNames.length > 3 ? '...' : ''})`
            : `${firstSpeaker.name} - ${firstSpeaker.description}`

        const conversationPreview =
          activeRounds.length > 1
            ? activeRounds
              .map((r) => {
                const spk = getVoice(r.voiceId)
                return `${spk.name}: "${r.text.trim()}"`
              })
              .join('  •  ')
            : newGen.textSnippet

        const newHist: HistoryEntry = {
          id: `hist-${now}`,
          text: conversationPreview,
          previewSnippet:
            conversationPreview.length > 160
              ? `${conversationPreview.slice(0, 157)}...`
              : conversationPreview,
          voiceName: voiceSummary,
          voiceColor: activeRounds.length > 1 ? '#10b981' : firstSpeaker.color,
          voiceAvatarUrl: firstSpeaker.avatarUrl || '/voices/sterling.jpg',
          dateGroup: 'Today',
          timeAgo: 'Just now',
          timestamp: now,
          model: currentEngine === 'chatterbox' ? 'Chatterbox T3' : 'CosyVoice 3',
          engine: currentEngine,
          duration: formatTime(newGen.duration),
          durationSec: newGen.duration,
          emotion: newGen.emotion,
          audioUrl: newGen.audioUrl,
          waveform: newGen.waveform || [],
          roundsData: JSON.parse(JSON.stringify(state.rounds)),
          voicePrompt: state.voicePrompt,
          language: state.language,
          speakerCount: speakerNames.length,
          generationId: newGen.id,
        }

        if (newGen.audioUrl) {
          saveAudioToCache(newHist.id, newGen.audioUrl).catch(console.error)
        }

        // Persist conversation and dialogue rounds to SQLite via Prisma
        dbService.saveConversation(newHist).catch((err) => {
          console.error('[TTS Screen] Failed to save conversation to SQLite:', err)
        })

        setLoadedHistoryId(newHist.id)

        updateState({
          generations: [newGen],
          activeGeneration: newGen,
          history: [newHist, ...state.history],
          isSynthesizing: false,
          synthesisProgress: '',
        })
      } else {
        console.error('[TTS Screen] Backend synthesis failed:', ipcResult.error)
        updateState({
          isSynthesizing: false,
          synthesisProgress: ipcResult.error || 'Synthesis failed',
        })
        setTimeout(() => {
          updateState({ synthesisProgress: '' })
        }, 3000)
      }
    } catch (err) {
      console.error('[TTS Screen] Error generating speech:', err)
      updateState({
        isSynthesizing: false,
        synthesisProgress: String(err),
      })
      setTimeout(() => {
        updateState({ synthesisProgress: '' })
      }, 3000)
    }
  }

  const handleLoadHistory = useCallback(
    async (item: HistoryEntry) => {
      if (!item) return
      voicePreview.stopPreview()
      player.pause()

      const targetEngine =
        item.engine ||
        (item.model?.toLowerCase().includes('chatterbox') ? 'chatterbox' : 'cosyvoice3')
      setSelectedEngine(targetEngine)

      let restoredRounds: SpeechRound[] = []
      if (item.roundsData && Array.isArray(item.roundsData) && item.roundsData.length > 0) {
        restoredRounds = JSON.parse(JSON.stringify(item.roundsData))
      } else if (item.text) {
        restoredRounds = [
          {
            id: `round-${Date.now()}`,
            voiceId: state.selectedVoiceId || 'voice-en-male-1',
            text: item.text,
            speed: 1.0,
            emotion: item.emotion || 'Neutral',
            pace: 'Moderate',
          },
        ]
      }

      let audioUrl = item.audioUrl
      if (!audioUrl) {
        audioUrl = (await getAudioFromCache(item.id)) || undefined
      }

      const durSec =
        item.durationSec ||
        (item.duration ? parseDurationStringToSec(item.duration) : 8)

      const restoredGen: Generation | null = audioUrl
        ? {
          id: item.generationId || `gen-${item.id}`,
          roundIndex: 0,
          title:
            item.speakerCount && item.speakerCount > 1
              ? `${item.speakerCount} Speakers Dialogue`
              : item.voiceName || 'Dialogue',
          textSnippet: item.text,
          speakerName: item.voiceName,
          speakerColor: item.voiceColor || '#10b981',
          speakerAvatarUrl: item.voiceAvatarUrl,
          duration: durSec,
          waveform: item.waveform && item.waveform.length > 0 ? item.waveform : [],
          timestamp: item.timeAgo || 'Restored',
          emotion: item.emotion || 'Neutral',
          audioUrl,
        }
        : null

      setLoadedHistoryId(item.id)

      updateState({
        rounds: restoredRounds,
        focusedRoundIndex: 0,
        engine: targetEngine,
        ...(item.voicePrompt !== undefined ? { voicePrompt: item.voicePrompt } : {}),
        ...(item.language ? { language: item.language } : {}),
        generations: restoredGen ? [restoredGen] : [],
        activeGeneration: restoredGen,
        isPlaying: false,
        currentTime: 0,
        playbackProgress: 0,
        playingHistoryId: null,
      })
    },
    [parseDurationStringToSec, player, setSelectedEngine, state.selectedVoiceId, updateState, voicePreview]
  )

  const handleTogglePlayHistory = useCallback(
    async (item: HistoryEntry) => {
      voicePreview.stopPreview()
      const genId = item.generationId || `gen-${item.id}`

      // Same history entry already loaded in the global player -> just toggle it
      if (player.currentTrack?.id === genId) {
        player.togglePlay()
        return
      }

      let audioUrl = item.audioUrl
      if (!audioUrl) {
        audioUrl = (await getAudioFromCache(item.id)) || undefined
      }
      if (!audioUrl) return

      const durSec =
        item.durationSec ||
        (item.duration ? parseDurationStringToSec(item.duration) : 8)

      const gen: Generation = {
        id: genId,
        roundIndex: 0,
        title:
          item.speakerCount && item.speakerCount > 1
            ? `${item.speakerCount} Speakers Dialogue`
            : item.voiceName || 'Dialogue',
        textSnippet: item.text,
        speakerName: item.voiceName,
        speakerColor: item.voiceColor || '#10b981',
        speakerAvatarUrl: item.voiceAvatarUrl,
        duration: durSec,
        waveform: item.waveform && item.waveform.length > 0 ? item.waveform : [],
        timestamp: item.timeAgo || 'Just now',
        emotion: item.emotion || 'Neutral',
        audioUrl,
      }

      setLoadedHistoryId(item.id)
      player.play(buildTrackFromGeneration(gen))
      updateState({
        generations: [gen],
        activeGeneration: gen,
        isPlaying: true,
        playingHistoryId: item.id,
        currentTime: 0,
        playbackProgress: 0,
      })
    },
    [parseDurationStringToSec, player, buildTrackFromGeneration, updateState, voicePreview]
  )

  return (
    <div className="flex h-full w-full select-none overflow-hidden bg-[#0f0f10] text-[#f4f4f5]">
      {/* ======================================================== */}
      {/* MAIN STAGE (Center/Left Editor Area & Bottom Bar)       */}
      {/* ======================================================== */}
      <div className="relative flex flex-1 flex-col h-full min-w-0 overflow-hidden bg-[#0f0f10]">
        <TopSubHeader
          totalRounds={state.rounds.length}
          engine={state.engine || selectedEngine}
          onEngineChange={(eng) => {
            updateState({ engine: eng })
            setSelectedEngine(eng)
          }}
        />

        {/* Delete all models button (always visible to reset out-of-sync / false-complete state) */}
        <div className="px-6 py-2 flex justify-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (
                window.confirm(
                  'Delete all downloaded models and reset state? This cannot be undone.',
                )
              ) {
                const ok = await deleteAllModels()
                if (!ok) {
                  window.alert('Failed to delete models. Check logs for details.')
                }
              }
            }}
            className="border-destructive hover:bg-destructive/20 text-destructive hover:text-white text-xs font-medium px-3 py-2"
          >
            🗑️ Delete All Models
          </Button>
        </div>

        {!allRequiredReady ? (
          <InstallRequiredModelsView />
        ) : (
          <>
            {/* Scrollable Dialogue / Speech Rounds Area */}
            <div className="flex-1 overflow-y-auto px-6 py-8 pb-60 sidebar-scrollbar">
              <div className="w-full flex flex-col gap-6">
                <Reorder.Group
                  axis="y"
                  values={state.rounds}
                  onReorder={(newRounds) => updateState({ rounds: newRounds })}
                  className="w-full flex flex-col gap-6"
                  as="div"
                >
                  <AnimatePresence initial={false}>
                    {state.rounds.map((round, index) => {
                      const speaker = getVoice(round.voiceId)
                      const isFocused = state.focusedRoundIndex === index
                      const isShuffling = state.shufflingRoundId === round.id
                      const isFirstDefault = index === 0 && round.id === 'round-1'

                      return (
                        <DialogueRoundCard
                          key={round.id}
                          round={round}
                          index={index}
                          totalRounds={state.rounds.length}
                          speaker={speaker}
                          voices={state.voices}
                          isFocused={isFocused}
                          isShuffling={isShuffling}
                          playingVoiceId={voicePreview.playingVoiceId}
                          onTogglePreview={voicePreview.togglePreview}
                          engine={state.engine || selectedEngine}
                          disableEnterAnimation={isFirstDefault}
                          onFocus={() => {
                            updateState({
                              focusedRoundIndex: index,
                              selectedVoiceId: round.voiceId,
                            })
                          }}
                          onUpdateRound={(updated) => {
                            updateState({
                              rounds: state.rounds.map((r, i) =>
                                i === index ? { ...r, ...updated } : r
                              ),
                              focusedRoundIndex: index,
                              ...(updated.voiceId ? { selectedVoiceId: updated.voiceId } : {}),
                            })
                          }}
                          onRemoveRound={() => handleRemoveRound(round.id)}
                          onOpenCloneModal={() => updateState({ isCloneModalOpen: true })}
                          onOpenExplorerModal={() => updateState({ isLanguageSelectorOpen: true })}
                          onInsertPauseTag={(tag) => handleInsertPauseTag(tag, index)}
                        />
                      )
                    })}
                  </AnimatePresence>
                </Reorder.Group>

                {/* Add Speaker Round button */}
                <motion.div layout="position" className="flex justify-start mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddSpeakerRound}
                    className="border-dashed border-[#2b2b30] hover:border-zinc-500 bg-[#141416]/40 hover:bg-white/[0.04] text-zinc-400 hover:text-white cursor-pointer shadow-xs gap-2 text-xs font-medium"
                  >
                    <Plus className="size-3.5 text-zinc-400" />
                    <span>Add Speaker Round</span>
                  </Button>
                </motion.div>

                {/* Latest Generation Wave Player with Emotion & Cloned Timbre metadata */}
                {state.generations.length > 0 && state.generations[0] && (
                  <div className="mt-4 flex w-full max-w-2xl flex-col items-start gap-2.5">
                    {/* Generation Metadata */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-400">
                      <span className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: state.generations[0].speakerColor }}
                        />
                        {state.generations[0].speakerName}
                      </span>

                      <span className="text-zinc-700">/</span>

                      <span>
                        Emotion:{" "}
                        <span className="text-zinc-300">
                          {state.generations[0].emotion || "Neutral"}
                        </span>
                      </span>

                      <span className="text-zinc-700">/</span>

                      <span>
                        CFG{" "}
                        <span className="tabular-nums text-zinc-300">
                          {state.cfgScale.toFixed(1)}
                        </span>
                      </span>

                      {state.lavaSrEnabled && (
                        <>
                          <span className="text-zinc-700">/</span>
                          <span className="text-zinc-300">48 kHz</span>
                        </>
                      )}
                    </div>

                    {/* Single global audio player: interactive waveform bound to the central audio element */}
                    <div className="flex w-full items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 transition-all active:scale-95 cursor-pointer shadow-xs"
                        title={isGenerationPlaying ? 'Pause' : 'Play'}
                      >
                        {isGenerationPlaying ? (
                          <Pause className="size-4 fill-black text-black" />
                        ) : (
                          <Play className="size-4 fill-black text-black ml-0.5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <TrackWavePlayer
                          trackId={state.generations[0].id}
                          waveform={
                            state.generations[0].waveform &&
                              state.generations[0].waveform.length > 0
                              ? state.generations[0].waveform
                              : undefined
                          }
                          duration={state.generations[0].duration || 8}
                          onPlay={handleTogglePlay}
                          height={32}
                        />
                      </div>

                      <span className="text-xs font-mono text-zinc-400 tabular-nums select-none shrink-0 min-w-[28px] text-right">
                        {formatTime(isGenerationPlaying ? state.currentTime : state.generations[0].duration || 8)}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          if (state.generations[0].audioUrl) {
                            downloadDataUriAsWav(
                              state.generations[0].audioUrl,
                              `${state.generations[0].title.replace(/\s+/g, "_")}-${state.generations[0].speakerName}.wav`
                            )
                          }
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                        title="Download Audio (.wav)"
                      >
                        <Download className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BOTTOM EDITOR ACTION BAR */}
            <SpeechEditorActionBar
              totalCharacters={totalCharacters}
              totalRounds={state.rounds.length}
              isSynthesizing={state.isSynthesizing}
              onAutoTag={handleAutoTag}
              onClear={handleClearEditor}
              onGenerate={handleGenerateSpeech}
              modelsReady={allRequiredReady}
            />
          </>
        )}

        {/* Synthesizing toast notification with ShimmeringText */}
        <AnimatePresence>
          {state.isSynthesizing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={cn(
                'absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-xl border border-[#27272a] bg-[#18181b]/95 px-4 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md transition-all duration-200',
                state.activeGeneration ? 'bottom-28' : 'bottom-14'
              )}
            >
              <div className="size-2 rounded-full bg-white animate-ping shrink-0" />
              <ShimmeringText
                key={state.synthesisProgress}
                text={state.synthesisProgress || 'Generating audio...'}
                startOnView={false}
                duration={1.8}
                color="#71717a"
                shimmerColor="#ffffff"
                className="font-medium text-xs tracking-wide"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* PERSISTENT BOTTOM AUDIO PLAYER */}
        {/* Playback is handled by the app-wide GlobalPlayerBar (RootLayout) - no local player here */}
      </div>

      {/* ======================================================== */}
      {/* RIGHT SIDE DRAWER: MODEL CONFIGURATIONS & HISTORY       */}
      {/* ======================================================== */}
      <div className="flex flex-col w-[420px] shrink-0 border-l border-[#1f1f23] bg-[#111113] h-full overflow-hidden">
        {/* Dual Tab Header: [Settings] [History] */}
        <LayoutGroup id="rightPanelTabs">
          <div className="flex h-10 shrink-0 items-center gap-1 px-3.5 select-none border-b border-[#1f1f23]">
            <button
              type="button"
              onClick={() => updateState({ rightPanelTab: 'settings' })}
              className={cn(
                'relative px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer rounded-md select-none',
                state.rightPanelTab === 'settings'
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {state.rightPanelTab === 'settings' && (
                <motion.div
                  layoutId="activeRightTabPill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 bg-white/[0.10] rounded-md"
                />
              )}
              <span className="relative z-10">Settings</span>
            </button>

            <button
              type="button"
              onClick={() => updateState({ rightPanelTab: 'history' })}
              className={cn(
                'relative px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer rounded-md select-none',
                state.rightPanelTab === 'history'
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {state.rightPanelTab === 'history' && (
                <motion.div
                  layoutId="activeRightTabPill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 bg-white/[0.10] rounded-md"
                />
              )}
              <span className="relative z-10">History</span>
            </button>
          </div>
        </LayoutGroup>

        {/* Panel Content with Horizontal Translation */}
        <div className="flex-1 overflow-hidden relative w-full h-full">
          <motion.div
            className="flex w-full h-full items-start"
            animate={{ x: `-${state.rightPanelTab === 'settings' ? 0 : 100}%` }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
          >
            <SettingsDrawer
              engine={state.engine || selectedEngine}
              onEngineChange={(eng) => {
                updateState({ engine: eng })
                setSelectedEngine(eng)
              }}
              onSwitchToCosyVoice={() => {
                updateState({ engine: 'cosyvoice3' })
                setSelectedEngine('cosyvoice3')
              }}
              activeVoice={activeVoice}
              voices={state.voices}
              selectedVoiceId={focusedRound?.voiceId || state.selectedVoiceId}
              focusedRoundNumber={state.focusedRoundIndex + 1}
              totalRounds={state.rounds.length}
              playingVoiceId={voicePreview.playingVoiceId}
              onTogglePreview={voicePreview.togglePreview}
              voicePrompt={focusedRound?.prompt !== undefined ? focusedRound.prompt : state.voicePrompt}
              onVoicePromptChange={(val) => {
                const targetIndex =
                  state.focusedRoundIndex >= 0 && state.focusedRoundIndex < state.rounds.length
                    ? state.focusedRoundIndex
                    : 0
                updateState({
                  voicePrompt: val,
                  rounds: state.rounds.map((r, i) =>
                    i === targetIndex ? { ...r, prompt: val } : r
                  ),
                })
              }}
              stability={state.stability}
              similarity={state.similarity}
              cfgScale={state.cfgScale}
              lavaSrEnabled={state.lavaSrEnabled}
              activeLanguage={activeLanguage}
              onSelectVoice={(id) => {
                const targetIndex =
                  state.focusedRoundIndex >= 0 && state.focusedRoundIndex < state.rounds.length
                    ? state.focusedRoundIndex
                    : 0
                updateState({
                  selectedVoiceId: id,
                  rounds: state.rounds.map((r, i) =>
                    i === targetIndex ? { ...r, voiceId: id } : r
                  ),
                })
              }}
              onOpenCloneModal={() => updateState({ isCloneModalOpen: true })}
              onOpenExplorerModal={() => updateState({ isLanguageSelectorOpen: true })}
              onStabilityChange={(val) => updateState({ stability: val })}
              onSimilarityChange={(val) => updateState({ similarity: val })}
              onCfgScaleChange={(val) => updateState({ cfgScale: val })}
              onToggleLavaSr={() => updateState({ lavaSrEnabled: !state.lavaSrEnabled })}
              onSelectLanguage={(lang) => {
                loadVoicesForLanguage(lang).then((langVoices) => {
                  const voicesToUse = langVoices.length > 0 ? langVoices : getVoicesForLanguage(lang)
                  const newVoiceId = voicesToUse[0]?.id
                  const targetIdx = state.focusedRoundIndex >= 0 ? state.focusedRoundIndex : 0
                  if (newVoiceId && lang !== 'Auto Detect') {
                    updateState({
                      language: lang,
                      selectedVoiceId: newVoiceId,
                      voices: Array.from(new Map([...state.voices, ...voicesToUse].map((v) => [v.id, v])).values()),
                      rounds: state.rounds.map((r, i) => (i === targetIdx ? { ...r, voiceId: newVoiceId } : r)),
                    })
                  } else {
                    updateState({ language: lang })
                  }
                })
              }}
            />

            <HistoryDrawer
              history={state.history}
              historySearch={state.historySearch}
              playingHistoryId={state.playingHistoryId}
              activeHistoryId={loadedHistoryId}
              onSearchChange={(q) => updateState({ historySearch: q })}
              onClearSearch={() => updateState({ historySearch: '' })}
              onSelectHistoryItem={handleLoadHistory}
              onTogglePlayHistory={handleTogglePlayHistory}
              onDeleteHistoryItem={(id) => {
                deleteAudioFromCache(id).catch(console.error)
                updateState({
                  history: state.history.filter((h) => h.id !== id),
                  ...(state.playingHistoryId === id ? { playingHistoryId: null, isPlaying: false } : {}),
                  ...(loadedHistoryId === id ? { activeGeneration: null, generations: [] } : {}),
                })
                if (loadedHistoryId === id) setLoadedHistoryId(null)
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* BRING YOUR OWN VOICE MODAL */}
      <VoiceCloneModal
        isOpen={state.isCloneModalOpen}
        engine={state.engine || selectedEngine}
        onSwitchToCosyVoice={() => {
          updateState({ engine: 'cosyvoice3' })
          setSelectedEngine('cosyvoice3')
        }}
        cloneMode={state.cloneMode}
        isRecording={state.isRecording}
        recordedDuration={state.recordedDuration}
        isPlayingRecording={state.isPlayingRecording}
        cloneVoiceName={state.cloneVoiceName}
        onClose={() => {
          recording.stopMicrophone()
          updateState({ isCloneModalOpen: false })
        }}
        onSetCloneMode={recording.handleSetCloneMode}
        onStartRecord={recording.handleStartRecord}
        onStopRecord={recording.handleStopRecord}
        onTogglePlayRecording={recording.handleTogglePlayRecording}
        onStreamReady={(stream) => {
          try {
            recording.recordedStreamRef.current = stream
            recording.audioChunksRef.current = []
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : MediaRecorder.isTypeSupported('audio/mp4')
                  ? 'audio/mp4'
                  : ''
            const mr = mimeType
              ? new MediaRecorder(stream, { mimeType })
              : new MediaRecorder(stream)
            mr.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                recording.audioChunksRef.current.push(e.data)
              }
            }
            mr.onstop = () => {
              if (recording.audioChunksRef.current.length > 0) {
                const blob = new Blob(recording.audioChunksRef.current, {
                  type: mr.mimeType || 'audio/webm',
                })
                updateState({ recordedAudioUrl: URL.createObjectURL(blob) })
              }
            }
            mr.start(100)
            recording.mediaRecorderRef.current = mr
          } catch (err) {
            console.warn('MediaRecorder error:', err)
          }
        }}
        onStreamEnd={recording.stopMicrophone}
        recordedAudioUrl={state.recordedAudioUrl}
        onSaveVoice={handleSaveVoice}
      />

      {/* VOICE & LANGUAGE EXPLORER DIALOG */}
      <VoiceLanguageExplorerDialog
        isOpen={state.isLanguageSelectorOpen}
        onClose={() => updateState({ isLanguageSelectorOpen: false })}
        activeVoiceId={focusedRound?.voiceId || state.selectedVoiceId}
        activeLanguage={activeLanguage}
        voices={state.voices}
        playingVoiceId={voicePreview.playingVoiceId}
        onTogglePreview={voicePreview.togglePreview}
        onSelectVoice={(voiceId) => {
          const targetIdx = state.focusedRoundIndex >= 0 ? state.focusedRoundIndex : 0
          updateState({
            selectedVoiceId: voiceId,
            rounds: state.rounds.map((r, i) => (i === targetIdx ? { ...r, voiceId } : r)),
          })
        }}
        onSelectLanguage={(langName) => {
          updateState({ language: langName })
        }}
        onOpenCloneModal={() => updateState({ isCloneModalOpen: true })}
        onVoicesLoaded={handleVoicesLoaded}
        onDeleteVoice={handleDeleteCustomVoice}
      />
    </div>
  )
}
