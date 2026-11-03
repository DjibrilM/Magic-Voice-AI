import { QvacEmotion, QvacPace } from '../interfaces/voice'

export const QVAC_MAX_CHARS_PER_ROUND = 4096

export const COSYVOICE_EMOTIONS: { label: QvacEmotion; description: string }[] = [
  { label: 'Neutral', description: 'Natural, balanced default vocal delivery' },
  { label: 'Happy', description: 'Upbeat, warm, and cheerful intonation' },
  { label: 'Sad', description: 'Subdued, somber, and reflective cadence' },
  { label: 'Anger', description: 'Assertive, intense, and emphatic projection' },
]

export const PARLER_EMOTIONS: { label: QvacEmotion; description: string }[] = [
  { label: 'Neutral', description: 'Natural, balanced default vocal delivery' },
  { label: 'Happy', description: 'Upbeat, warm, and cheerful intonation' },
  { label: 'Sad', description: 'Subdued, somber, and reflective cadence' },
  { label: 'Anger', description: 'Assertive, intense, and emphatic projection' },
  { label: 'Narration', description: 'Measured, articulate storytelling pace' },
  { label: 'Conversation', description: 'Spontaneous, informal conversational flow' },
  { label: 'Surprise', description: 'Elevated pitch with expressive dynamic range' },
  { label: 'Command', description: 'Authoritative, firm directive timbre' },
  { label: 'Fear', description: 'Tense, apprehensive, and breathless cadence' },
  { label: 'Disgust', description: 'Aversive, harsh, and dismissive intonation' },
  { label: 'News', description: 'Formal, objective journalistic projection' },
  { label: 'Proper Noun', description: 'Crisp, deliberate articulation for names' },
]

export const QVAC_EMOTIONS = PARLER_EMOTIONS

export const QVAC_PACES: { label: QvacPace; rate: string; multiplier: number }[] = [
  { label: 'Slow', rate: '0.8x', multiplier: 0.8 },
  { label: 'Moderate', rate: '1.0x', multiplier: 1.0 },
  { label: 'Fast', rate: '1.25x', multiplier: 1.25 },
]

export const QVAC_PAUSES = [
  { tag: '[pause 0.5s]', label: '0.5s' },
  { tag: '[pause 1.0s]', label: '1.0s' },
  { tag: '[pause 2.0s]', label: '2.0s' },
]

export const QVAC_REACTION_CUES = [
  { tag: '[hmm]', label: 'Hmm' },
]

export const QVAC_TONE_CUES = [
  { tag: '[yell]', closeTag: '[/yell]', label: 'Yell', description: 'Shouting and elevated vocal projection' },
  { tag: '[raise]', closeTag: '[/raise]', label: 'Raise', description: 'Pitch accent and melodic emphasis' },
  { tag: '[whisper]', closeTag: '[/whisper]', label: 'Whisper', description: 'Soft, hushed intimate cadence' },
]


