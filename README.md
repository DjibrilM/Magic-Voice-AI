 <p align="center">
  <img src="./icon.png" alt="Magic-Voice AI Logo" width="128" height="128" />
</p>

<h1 align="center">Magic-Voice AI</h1>

<p align="center">
  <strong>Local, Private, Multi-Speaker Text-to-Speech Studio powered by CosyVoice 3</strong>
</p>



https://github.com/user-attachments/assets/7c207d17-8b4a-4854-a62a-074524a09ad2


---

## Overview

**Magic-Voice AI** is an offline desktop Text-to-Speech (TTS) studio built with Electron, React, TypeScript, Tailwind CSS, and the `@qvac/sdk`. It is engineered specifically for local speech synthesis, voice design, zero-shot voice cloning, and multi-turn conversational script generation without cloud latency, tracking, or network dependencies.

Magic-Voice AI runs exclusively on **CosyVoice 3** (FunAudioLLM), offering continuous flow-matching acoustic generation, precise emotion conditioning, and 48kHz studio-grade spectral upsampling via Lava-SR.

---

## Key Features

- **Exclusive CosyVoice 3 Engine**: Built from the ground up for CosyVoice 3 (0.5B LLM Backbone + Flow Matching Vocoder + S3Tok + CAM++ + Lava-SR Enhancer).

- **GPU & CPU Hardware Inference Switch**:
  - **GPU (Metal)**: Enabled by default, leveraging Apple Silicon Metal shaders for accelerated real-time synthesis.
  - **CPU**: Fallback standard thread processing when dedicated GPU compute is reserved or disabled.
  - Persistent user preference saved across app restarts and dynamically respected when loading model weights.

- **Instant Zero-Shot Voice Cloning**: Clone reference voices from custom audio files (WAV, MP3, AAC) or microphone recordings using deep CAM++ speaker embeddings.

- **Multi-Speaker Conversational Turn Generation**: Script dialogues between multiple characters with independent pacing, emotions, pre/post pauses, and crossfaded room tone.

- **Conversational Reaction & Tone Tags**:
  - `[whisper]`: Soft voice delivery padded with gentle breath pauses.
  - `[yell]` or `[loud]`: Forceful, elevated dynamic projection with anger emotion injection.
  - `[raise]` or `[emphasis]`: Natural pitch accentuation via native CosyVoice `<strong>` tagging.
  - `[breath]`, `[sigh]`, `[gasp]`: Sub-second respiration pauses via native `<breath>` tagging.

- **iOS-Inspired Settings & Storage**:
  - Slim multi-segment storage progress bar (`h-1.5`) breaking down installed models and saved audio media.
  - Clean monochromatic white iconography across all cards and controls.
  - Custom destination folder selection with automatic file routing and "Open in Finder" integration.
  - One-click disk space reclamation ("Delete All Models").

---

## Neural Model Suite (CosyVoice 3)

The application utilizes 5 models:

| Model ID | Component | Quantization / Format | Size | Role |
| :--- | :--- | :--- | :--- | :--- |
| `cosyvoice3-llm-q8_0` | Speech Backbone | Q8_0 GGUF (0.5B) | ~973 MB | Generates autoregressive acoustic token sequences conditioned on text and voice prompts. |
| `cosyvoice3-flow-fp16` | Acoustic Vocoder | FP16 ODE | ~639 MB | Full-precision continuous flow-matching vocoder synthesizing acoustic waveforms with natural breath. |
| `cosyvoice3-s3tok-fp16` | Speech Tokenizer | FP16 | ~496 MB | Encodes reference voice prompts into discrete acoustic tokens for zero-shot cloning. |
| `cosyvoice3-campplus-fp32` | Speaker Encoder | FP32 | ~27 MB | Deep speaker verification and timbre embedding extractor. |
| `lavasr-enhancer` | Super-Resolution | FP16 | ~28 MB | Spectral bandwidth upsampler enhancing 24kHz native audio to studio 48kHz Ultra-HD. |

---

## Hardware Inference Compute Device (GPU vs CPU)

Magic-Voice AI supports dynamic hardware device selection:

- **Default Device**: **GPU** (Apple Silicon Metal).
- **Configuration Persistence**: Stored in `userData/magic-voice-settings.json`.
- **Model Loading Integration**: When `qvacSdk.loadModel` is invoked, `useGPU: inferenceDevice === 'gpu'` is evaluated.
- **Cache Management**: Switching compute devices automatically flushes previously loaded engine handles, ensuring the subsequent synthesis task instantiates models on the chosen backend.

---

## Development & Build

### Prerequisites

- macOS (Apple Silicon M1/M2/M3/M4 recommended) or Windows (x64)
- Node.js 18+ & npm

### Setup & Packaging

```bash
# Clone the repository
git clone https://github.com/your-username/Magic-Voice-ai.git
cd Magic-Voice-ai

# Install dependencies and generate Prisma client
npm install

# Start local development server (Electron + Vite)
npm run dev

# Type check codebase
npx tsc --noEmit

# Build production renderer and Electron bundles
npm run build

# Build macOS DMG installer (arm64 + x64)
npm run build:dmg

# Build Windows NSIS installer
npm run build:win
```

---

## Project Architecture

```text
Magic-Voice-ai/
├── icon.png                   # Application logo
├── electron/                  # Electron Main Process & Clean Core Architecture
│   ├── main.ts                # Application lifecycle and window bootstrapping
│   ├── preload.ts             # Context isolation bridge & secure IPC exposition
│   └── core/                  # Modular Core Domain Services & Controllers
│       ├── base.controller.ts # Abstract IPC controller base class
│       ├── ipc-channels.ts    # Centralized typed IPC channel definitions
│       ├── system/            # Disk storage, exports, media folder, compute device
│       ├── models/            # Model discovery, download tracking, file status
│       ├── voices/            # Voice preset catalogs and custom voice database
│       └── tts/               # CosyVoice 3 engine orchestration, PCM audio processing
├── src/                       # React Frontend Application
│   ├── components/            # Shared UI components (Radix primitives, dialogs, sliders)
│   ├── lib/                   # Utility helpers, storage utilities, and interfaces
│   ├── modules/               # Domain feature modules
│   │   ├── models/            # Model downloads, disk ready state atom, store
│   │   └── text-to-speech/    # Dialogue script editor, SettingsDrawer, HistoryDrawer
│   └── pages/                 # Root views: TextToSpeech, CustomVoices, Settings
└── docs/                      # Technical documentation & Architecture breakdown
    ├── ARCHITECTURE.md        # Technical architecture reference
    └── HOW_IT_WORKS.md        # In-depth article: How to run & how it works under the hood
```

---

## License

MIT License. Engineered for offline audio synthesis.
