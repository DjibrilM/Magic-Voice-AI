# Magic-Voice AI — System Architecture & TTS Pipeline

This document details the architectural design, IPC communication layer, audio synthesis pipeline, and model orchestration of **Magic-Voice AI**.

---

## 1. System Topology

Magic-Voice AI follows a decoupled architecture separating the user interface (React + Jotai) from the background synthesis orchestration and system calls (Electron Main Process):

```
+--------------------------------------------------------------------------+
|                        React Frontend Application                        |
|                                                                          |
|  +--------------------+   +---------------------+   +-----------------+  |
|  | TextToSpeechScreen |   |   SettingsDrawer    |   |  Settings Page  |  |
|  +--------------------+   +---------------------+   +-----------------+  |
|            |                         |                       |           |
|            v                         v                       v           |
|  +--------------------------------------------------------------------+  |
|  |                 Jotai State Store & Module Hooks                   |  |
|  |    (ttsStore, modelsStore, allRequiredModelsReadyAtom, useModels)  |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
                                     |
                       IPC Bridge (electron/preload.ts)
                                     |
+--------------------------------------------------------------------------+
|                       Electron Core Architecture                         |
|                                                                          |
|  +---------------------+   +---------------------+   +-----------------+ |
|  |  SystemController   |   |   ModelsController  |   |  TtsController  | |
|  +---------------------+   +---------------------+   +-----------------+ |
|            |                         |                       |           |
|            v                         v                       v           |
|  +---------------------+   +---------------------+   +-----------------+ |
|  |    SystemService    |   |    ModelsService    |   |    TtsService   | |
|  +---------------------+   +---------------------+   +-----------------+ |
|            |                                                 |           |
|            |  Hardware Device Event: onInferenceDeviceChanged|           |
|            +------------------------------------------------>+           |
|                                                              |           |
|                                                              v           |
|                                                    +-------------------+ |
|                                                    | VoiceEngineService| |
|                                                    +-------------------+ |
|                                                              |           |
|                                                              v           |
|                                                    +-------------------+ |
|                                                    |     @qvac/sdk     | |
|                                                    | (CosyVoice 3 ODE) | |
|                                                    +-------------------+ |
+--------------------------------------------------------------------------+
```

---

## 2. CosyVoice 3 Synthesis Pipeline

Synthesis flows through 6 stages in `VoiceEngineService`:

```
Input Dialogue Turns
       |
       v
Stage 1: Text Sanitization & Conversational Cue Translation
  - Parses pointed tone manipulation: [whisper], [yell], [raise]
  - Normalizes emotion tags and reactions: [sigh], [breath], [gasp], [hmm]
  - Transforms cues to FunAudioLLM native instruct tags: <strong>, <breath>
       |
       v
Stage 2: Chunk Segmentation & Prosody Cadence
  - Splits text into natural sentence chunks (up to 36 words / ~15s)
  - Retains sentence boundary structure to prevent unnatural prosody drift
       |
       v
Stage 3: Compute Backend Evaluation & Model Loading
  - Reads inferenceDevice setting ('gpu' | 'cpu')
  - Evaluates useGPU: inferenceDevice === 'gpu' (Metal on Apple Silicon)
  - Loads CosyVoice 3 LLM Backbone (0.5B Q8_0) + Flow Matching Vocoder (FP16)
  - Attaches CAM++ speaker encoder + S3Tok tokenizer when voice reference is active
  - Attaches Lava-SR 48kHz spectral upsampler if enabled
       |
       v
Stage 4: Neural Inference Execution
  - Calls qvacSdk.textToSpeech(ttsPayload) with streaming PCM buffer
  - Collects uncompressed float samples at native sample rate (24kHz or 48kHz)
       |
       v
Stage 5: Audio Post-Processing & Master Stitching
  - Trims model pre-roll and post-roll dead air silence
  - Equal-power 12ms–14ms crossfading between sentences and turns
  - Inserts calibrated acoustic room pause (0.14s clause, 0.38s sentence, 0.65s inter-turn)
       |
       v
Stage 6: Persistence & Audio Delivery
  - Writes master PCM buffer to .wav in user-configured Media Destination Folder
  - Generates Data URI audio stream and 38-band peak waveform for UI playback
```

---

## 3. Hardware Compute Device Switching (GPU vs CPU)

### Architecture
- **Default Value**: `gpu` (Metal acceleration).
- **Service Owner**: `SystemService` manages hardware device selection and persistence in `userData/magic-voice-settings.json`.
- **IPC Interface**:
  - `system:getInferenceDevice` -> returns `'gpu' | 'cpu'`.
  - `system:setInferenceDevice` -> updates setting, persists to disk, and broadcasts changes.
- **Engine Binding**:
  - `SystemService.onInferenceDeviceChanged` notifies `TtsService.setInferenceDevice`.
  - `VoiceEngineService.setInferenceDevice` invalidates previously cached model instances (`this.loadedModels.clear()`) and calls `qvacSdk.unloadModel`.
  - Next synthesis request dynamically loads weights with `useGPU: this.inferenceDevice === 'gpu'`.

---

## 4. IPC Channels Reference

| Channel | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `system:getStorageInfo` | Renderer -> Main | `void` | Retrieves disk usage, model presence, media count, and active compute device. |
| `system:getInferenceDevice` | Renderer -> Main | `void` | Returns current compute device (`'gpu' \| 'cpu'`). |
| `system:setInferenceDevice` | Renderer -> Main | `'gpu' \| 'cpu'` | Configures and persists compute device. |
| `system:selectMediaFolder` | Renderer -> Main | `void` | Opens macOS folder selection dialog for exported media. |
| `system:openExports` | Renderer -> Main | `void` | Opens destination media folder in macOS Finder. |
| `models:get-status` | Renderer -> Main | `selectedEngine?: 'cosyvoice3'` | Returns download status of all CosyVoice 3 models. |
| `models:download` | Renderer -> Main | `modelId: string` | Initiates single model download with live progress. |
| `models:cancel-download`| Renderer -> Main | `modelId: string` | Cancels in-progress model download. |
| `models:delete-all` | Renderer -> Main | `void` | Removes all downloaded model weights from disk. |
| `tts:generate` | Renderer -> Main | `TtsGenerateOptions` | Executes complete CosyVoice 3 synthesis pipeline. |
| `tts:cancel` | Renderer -> Main | `taskId: string` | Aborts active synthesis task immediately. |

---

## 5. Conversational Cues & Instruct Tags

CosyVoice 3 supports zero-shot instructions and native XML cues:

- **`<breath>`**: Sub-second inhalation/pause. Inserted via `[breath]`, `[sigh]`, or `[gasp]`.
- **`<strong>Text</strong>`**: Dynamic emphasis and pitch accentuation. Inserted via `[raise]Text[/raise]` or `[emphasis]Text[/emphasis]`.
- **Whisper**: Softened amplitude with slow pacing and respiration padding (`<breath> text <breath>`).
- **Yell / Projection**: Uppercase transformed text with forceful projection and angry emotion bias.
- **Natural Pauses**: Explicit duration pauses (`[pause 0.5s]`, `[pause 1.2s]`) translated into acoustic room tone.

