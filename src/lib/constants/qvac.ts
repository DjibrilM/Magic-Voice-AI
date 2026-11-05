import { QvacEmotion, QvacPace, QvacSpeakingTone } from '../interfaces/voice'

export const QVAC_MAX_CHARS_PER_ROUND = 4096

export const COSYVOICE_EMOTIONS: { label: QvacEmotion; description: string }[] = [
  { label: 'Neutral', description: 'True zero-shot voice prosody & natural breath cadence' },
  { label: 'Warm', description: 'Gentle, friendly smiling warmth & approachable tone' },
  { label: 'Happy', description: 'Upbeat, joyful, and cheerful vocal intonation' },
  { label: 'Sad', description: 'Subdued, somber, and reflective emotional delivery' },
  { label: 'Anger', description: 'Assertive, intense, and forceful vocal projection' },
]

export const COSYVOICE_SPEAKING_TONES: {
  label: QvacSpeakingTone
  description: string
  badge?: string
}[] = [
  {
    label: 'Natural',
    description: 'Unconditioned zero-shot flow preserving reference breath & cadence',
    badge: 'Zero-Shot',
  },
  {
    label: 'Warm & Smiling',
    description: 'Friendly smiling vocal warmth with approachable inflection',
    badge: 'Smile',
  },
  {
    label: 'Conversational',
    description: 'Relaxed, candid everyday dialogue with natural respiration',
    badge: 'Candid',
  },
  {
    label: 'Storyteller',
    description: 'Measured, expressive audiobook & narrative storytelling',
    badge: 'Narrative',
  },
  {
    label: 'Empathetic',
    description: 'Gentle, caring, and reassuring vocal warmth',
    badge: 'Gentle',
  },
  {
    label: 'Soft & Hushed',
    description: 'Intimate, soft-spoken whisper delivery (CosyVoice soft volume)',
    badge: 'Soft',
  },
  {
    label: 'Projecting & Loud',
    description: 'High-projection, energetic stage delivery (CosyVoice loud volume)',
    badge: 'Loud',
  },
  {
    label: 'Broadcast',
    description: 'Crisp, composed studio podcast & news anchor cadence',
    badge: 'Studio',
  },
]

export const PARLER_EMOTIONS: { label: QvacEmotion; description: string }[] = [
  { label: 'Neutral', description: 'Natural, balanced default vocal delivery' },
  { label: 'Warm', description: 'Gentle, friendly smiling warmth & approachable tone' },
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
  { tag: '[smile]', label: 'Smile', description: 'Warm smiling vocal inflection' },
  { tag: '[laugh]', label: 'Laugh', description: 'Natural vocal laughter' },
  { tag: '[chuckle]', label: 'Chuckle', description: 'Gentle conversational chuckle' },
  { tag: '[breath]', label: 'Breath', description: 'Natural respiration pause' },
  { tag: '[sigh]', label: 'Sigh', description: 'Expressive vocal sigh' },
  { tag: '[gasp]', label: 'Gasp', description: 'Surprised intake of breath' },
  { tag: '[hmm]', label: 'Hmm', description: 'Thoughtful conversational hesitation' },
]

export const QVAC_TONE_CUES = [
  {
    tag: '[smile]',
    closeTag: '[/smile]',
    label: 'Smile Phrase',
    description: 'Speak wrapped words with a warm, friendly smile',
  },
  {
    tag: '[laugh]',
    closeTag: '[/laugh]',
    label: 'Laugh Phrase',
    description: 'Speak wrapped words while laughing',
  },
  {
    tag: '[raise]',
    closeTag: '[/raise]',
    label: 'Emphasis',
    description: 'Pitch accent and vocal emphasis on wrapped words',
  },
  {
    tag: '[whisper]',
    closeTag: '[/whisper]',
    label: 'Whisper',
    description: 'Soft, hushed intimate cadence',
  },
  {
    tag: '[yell]',
    closeTag: '[/yell]',
    label: 'Loud',
    description: 'Projected, forceful vocal delivery',
  },
]

export const COSYVOICE_DIALECT_OPTIONS: { value: string; label: string; nativeLabel: string }[] = [
  { value: '', label: 'Standard (Default)', nativeLabel: 'Zero-Shot Native' },
  { value: 'cantonese', label: 'Cantonese', nativeLabel: '广东话' },
  { value: 'sichuan', label: 'Sichuanese', nativeLabel: '四川话' },
  { value: 'shanghai', label: 'Shanghainese', nativeLabel: '上海话' },
  { value: 'northeastern', label: 'Northeastern', nativeLabel: '东北话' },
  { value: 'minnan', label: 'Minnan / Hokkien', nativeLabel: '闽南话' },
  { value: 'tianjin', label: 'Tianjin', nativeLabel: '天津话' },
  { value: 'shandong', label: 'Shandong', nativeLabel: '山东话' },
  { value: 'shaanxi', label: 'Shaanxi', nativeLabel: '陕西话' },
  { value: 'henan', label: 'Henan', nativeLabel: '河南话' },
  { value: 'hunan', label: 'Hunan', nativeLabel: '湖南话' },
  { value: 'hubei', label: 'Hubei', nativeLabel: '湖北话' },
]



