import { useAtom } from 'jotai'
import { TextToSpeechState, INITIAL_HISTORY, INITIAL_PARLER_SPEAKERS } from '../types'
import { ttsCompositeStateAtom } from '../store/ttsStore'

export const initialTextToSpeechState: TextToSpeechState = {
  // Voice engine & Per-Speaker Personas
  parlerSpeakers: INITIAL_PARLER_SPEAKERS,
  selectedParlerSpeakerId: 'speaker-1',

  // Voice & Language selection
  language: 'English (US)',
  searchLangQuery: '',
  isLanguageSelectorOpen: false,
  selectedVoiceId: 'voice-en-male-1',
  voices: [],

  // Multi-speaker dialogue rounds
  rounds: [
    {
      id: 'round-1',
      voiceId: 'voice-en-male-1',
      text: '',
      speed: 1.0,
      emotion: 'Neutral',
      pace: 'Moderate',
    },
  ],
  focusedRoundIndex: 0,
  shufflingRoundId: null,

  // Generation & Active Playback (only populated after generating speech)
  generations: [],
  activeGeneration: null,
  isSynthesizing: false,
  synthesisProgress: '',
  isPlaying: false,
  playbackProgress: 0,
  currentTime: 0,
  seekTarget: null,
  isMuted: false,
  volume: 0.85,
  prevVolume: 0.85,

  // Bring Your Own Voice modal
  isCloneModalOpen: false,
  cloneVoiceName: '',
  cloneVoiceGender: 'Female',
  cloneVoiceTags: [],
  cloneCustomTag: '',
  cloneFile: null,
  isRecording: false,
  recordedDuration: 0,
  cloneMode: 'upload',
  recordedAudioUrl: null,
  isPlayingRecording: false,

  // Model parameters (Right drawer)
  voicePrompt: '',
  stability: 0.5,
  similarity: 0.75,
  styleExaggeration: 0.0,
  speed: 1.0,
  cfgScale: 2.0,
  lavaSrEnabled: true,

  // Right Drawer Tab & History
  rightPanelTab: 'settings',
  history: INITIAL_HISTORY,
  historySearch: '',
  playingHistoryId: null,
}

export function useTextToSpeechState() {
  const [state, updateState] = useAtom(ttsCompositeStateAtom)

  return [state, updateState] as const
}
