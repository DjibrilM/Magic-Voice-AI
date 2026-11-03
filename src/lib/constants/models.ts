import { ChatterboxModel } from '../interfaces/model'

export const CHATTERBOX_MODELS: ChatterboxModel[] = [
  {
    id: 'cb-t3-turbo',
    name: 'Chatterbox T3 Turbo (GGUF)',
    badge: 'V4 Q8',
    description: 'Ultra-low latency zero-shot neural synthesis, optimized for WSOLA motion and fast turnaround.',
    recommended: true,
  },
  {
    id: 'cb-expressive-v12',
    name: 'Chatterbox Expressive v1.2',
    badge: 'FP16',
    description: 'Highest dynamic prosody range for dramatic scripts, multi-turn character dialogues, and acting.',
    recommended: false,
  },
  {
    id: 'cb-mtl-05b',
    name: 'Chatterbox MTL 0.5B Multilingual',
    badge: 'MTL',
    description: 'Cross-lingual zero-shot voice transfer supporting 23 international languages.',
    recommended: false,
  },
]
