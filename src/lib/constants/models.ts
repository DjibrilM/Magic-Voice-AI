import { VoiceModelOption } from '../interfaces/model'

export const COSYVOICE_MODELS: VoiceModelOption[] = [
  {
    id: 'cosyvoice3-llm-q8_0',
    name: 'CosyVoice 3 LLM (Q8_0 GGUF)',
    badge: 'Q8_0',
    description: '0.5B generative backbone producing expressive prosody, emotion conditioning, and natural pitch flow.',
    recommended: true,
  },
  {
    id: 'cosyvoice3-flow-fp32',
    name: 'CosyVoice 3 Flow Matching Vocoder',
    badge: 'FP32',
    description: 'Full-precision continuous flow-matching acoustic vocoder for pristine, broadcast-grade speech synthesis.',
    recommended: true,
  },
]
