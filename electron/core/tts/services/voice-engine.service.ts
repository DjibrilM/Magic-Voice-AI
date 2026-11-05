import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { app } from "electron";
import * as qvacSdk from "@qvac/sdk";

import type {
  TtsGenerateOptions,
  TtsGenerateResult,
  TtsGenerationOutput,
  TtsProgressCallback,
  TtsLogCallback,
} from "../interfaces";
import type {
  VoiceModelStatusResult,
  ModelDownloadProgressPayload,
} from "../../models/interfaces";
import { ModelsService } from "../../models/services/models.service";


function pcmToWavDataUri(samples: number[], sampleRate: number): string {
  sampleRate = Number.isFinite(sampleRate) && sampleRate > 0 ? Math.round(sampleRate) : 24000;
  const numSamples = samples.length;
  const headerSize = 44;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(headerSize + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // QVAC returns signed 16-bit PCM values in number[] form. Do not infer
  // float PCM from a small peak: quiet int16 audio can also peak below 1.
  for (let i = 0; i < numSamples; i++) {
    const sample = Number.isFinite(samples[i]) ? Math.round(samples[i]) : 0;
    const value = Math.max(-32768, Math.min(32767, sample));
    buffer.writeInt16LE(value, headerSize + i * 2);
  }
  return `data:audio/wav;base64,${buffer.toString("base64")}`;
}

function computePeaks(samples: number[], count: number): number[] {
  count = Math.max(1, Math.floor(count));
  if (samples.length === 0) return Array(count).fill(4);
  const peaks: number[] = [];
  const chunk = Math.max(1, Math.floor(samples.length / count));
  for (let i = 0; i < count; i++) {
    let max = 0;
    const start = i * chunk;
    const end = Math.min(samples.length, start + chunk);
    for (
      let j = start;
      j < end;
      j += Math.max(1, Math.floor((end - start) / 40))
    ) {
      const a = Math.abs(samples[j] / 32768);
      if (a > max) max = a;
    }
    peaks.push(Math.max(4, Math.min(98, Math.round(max * 100))));
  }
  return peaks;
}

/**
 * Writes raw PCM samples to a playable WAV file under the media destination directory
 * and assets/testing-voice-output for diagnostic playback.
 */
function savePcmAsWavFile(
  samples: number[],
  sampleRate: number,
  label: string,
  targetDir?: string,
): string {
  sampleRate = Number.isFinite(sampleRate) && sampleRate > 0 ? Math.round(sampleRate) : 24000;
  const numSamples = samples.length;
  const headerSize = 44;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(headerSize + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Preserve QVAC's signed 16-bit PCM samples exactly (apart from clamping).
  for (let i = 0; i < numSamples; i++) {
    const sample = Number.isFinite(samples[i]) ? Math.round(samples[i]) : 0;
    const value = Math.max(-32768, Math.min(32767, sample));
    buffer.writeInt16LE(value, headerSize + i * 2);
  }
  const maxAbs = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);

  const fileName = `${label}-${Date.now()}.wav`;
  let primaryFilePath = "";

  // 1. Primary destination: user-configured media exports folder
  if (targetDir) {
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      primaryFilePath = path.join(targetDir, fileName);
      fs.writeFileSync(primaryFilePath, buffer);
    } catch (err) {
      console.warn("[TTS] Failed to save to media destination folder:", err);
    }
  }

  // 2. Also save to local assets/testing-voice-output cache
  try {
    const dir = path.resolve(process.cwd(), "assets/testing-voice-output");
    fs.mkdirSync(dir, { recursive: true });
    const localFilePath = path.join(dir, fileName);
    fs.writeFileSync(localFilePath, buffer);
    if (!primaryFilePath) primaryFilePath = localFilePath;
  } catch {}

  console.log(
    `[TTS Debug] Saved PCM to ${primaryFilePath} (${numSamples} samples @ ${sampleRate}Hz, maxAbs=${maxAbs.toFixed(4)})`,
  );
  return primaryFilePath;
}

interface TextOrPauseSegment {
  type: "speech" | "pause";
  text?: string;
  pauseSec?: number;
  tone?: "normal" | "whisper" | "yell" | "raise" | "smile" | "laugh";
}

/**
 * Generates natural studio acoustic room tone for pauses instead of
 * absolute digital zero silence, with smooth cosine cross-fade tapers
 * at boundaries to eliminate digital clicking, ear-vacuum artifacts, and noise gating.
 */
function generateAcousticRoomPause(durationSec: number, sampleRate: number): number[] {
  const numSamples = Math.floor(sampleRate * Math.max(0.015, durationSec));
  const samples = new Array<number>(numSamples);

  // Natural studio floor noise (~ -65dB to -70dB)
  // 1-pole low-pass filtered to sound like soft microphone acoustic air
  let lastNoise = 0;
  for (let i = 0; i < numSamples; i++) {
    const white = (Math.random() * 2 - 1) * 5.0;
    lastNoise = lastNoise * 0.85 + white * 0.15;
    samples[i] = lastNoise;
  }

  // Apply smooth cosine fade-in and fade-out (8ms)
  const fadeLen = Math.min(Math.floor(sampleRate * 0.008), Math.floor(numSamples / 2));
  for (let i = 0; i < fadeLen; i++) {
    const gainIn = 0.5 * (1 - Math.cos((Math.PI * i) / fadeLen));
    samples[i] *= gainIn;
    const gainOut = 0.5 * (1 - Math.cos((Math.PI * (fadeLen - i)) / fadeLen));
    samples[numSamples - 1 - i] *= gainOut;
  }

  return samples;
}

/**
 * Trims leading and trailing model dead-air silence from a raw PCM chunk.
 * Uses a dynamic energy threshold based on peak amplitude, leaving a 25ms pre-roll
 * and 60ms post-roll so initial consonants and natural breath decays are never clipped.
 */
function trimPcmSilence(
  samples: number[],
  sampleRate: number,
  preRollMs = 25,
  postRollMs = 60
): number[] {
  if (samples.length === 0) return samples;

  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > maxAbs) maxAbs = a;
  }
  if (maxAbs === 0) return samples;

  // Threshold calibrated to 0.8% of peak speech amplitude (~ -42dB relative to peak)
  const threshold = Math.max(maxAbs * 0.008, maxAbs > 2 ? 60 : 0.002);
  const preRoll = Math.floor((sampleRate * preRollMs) / 1000);
  const postRoll = Math.floor((sampleRate * postRollMs) / 1000);

  let startIdx = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > threshold) {
      startIdx = Math.max(0, i - preRoll);
      break;
    }
  }

  let endIdx = samples.length;
  for (let i = samples.length - 1; i >= startIdx; i--) {
    if (Math.abs(samples[i]) > threshold) {
      endIdx = Math.min(samples.length, i + 1 + postRoll);
      break;
    }
  }

  if (startIdx >= endIdx || endIdx - startIdx < sampleRate * 0.08) {
    return samples;
  }

  return samples.slice(startIdx, endIdx);
}

/**
 * Appends new samples to target buffer using equal-power crossfading (12ms)
 * to ensure seamless continuity in room ambiance and completely eliminate
 * audible splices, clicks, phase dips, or unnatural gaps.
 */
function crossfadeAppend(
  target: number[],
  incoming: number[],
  sampleRate: number,
  crossfadeMs = 12
): void {
  if (incoming.length === 0) return;
  if (target.length === 0) {
    for (let i = 0; i < incoming.length; i++) target.push(incoming[i]);
    return;
  }

  const crossLen = Math.min(
    Math.floor((sampleRate * crossfadeMs) / 1000),
    Math.floor(target.length / 2),
    Math.floor(incoming.length / 2)
  );

  if (crossLen <= 0) {
    for (let i = 0; i < incoming.length; i++) target.push(incoming[i]);
    return;
  }

  const targetStart = target.length - crossLen;
  for (let i = 0; i < crossLen; i++) {
    const t = i / crossLen;
    // Equal-power crossfade curve: cos^2(t) + sin^2(t) = 1
    const gainOut = Math.cos(t * (Math.PI / 2));
    const gainIn = Math.sin(t * (Math.PI / 2));
    target[targetStart + i] = target[targetStart + i] * gainOut + incoming[i] * gainIn;
  }

  for (let i = crossLen; i < incoming.length; i++) {
    target.push(incoming[i]);
  }
}

interface ProcessedSpeechResult {
  cleanedText: string;
  detectedCues: string[];
  tone: "normal" | "whisper" | "yell" | "raise" | "smile" | "laugh";
}

export type CosyVoiceInstructOption =
  | string
  | {
      dialect?: string;
      volume?: "loud" | "soft";
      style?: "peppa" | "robot";
    };

const VALID_COSYVOICE_DIALECTS = new Set([
  "cantonese",
  "northeastern",
  "gansu",
  "guizhou",
  "henan",
  "hubei",
  "hunan",
  "jiangxi",
  "minnan",
  "ningxia",
  "shanxi",
  "shaanxi",
  "shandong",
  "shanghai",
  "sichuan",
  "tianjin",
  "yunnan",
]);

/**
 * Maps speaking tones, reaction cues, and extended emotions to Fun-CosyVoice3-0.5B's
 * native instruction format (`You are a helpful assistant. 请用...说一句话。<|endofprompt|>`).
 *
 * Inside `qvac-tts.cpp` (`cosyvoice_pipeline.cpp`), all built-in CosyVoice 3 instructions use
 * pure Chinese sentences of the form `"请用...说一句话。"`. Passing clean Chinese instructions
 * before `<|endofprompt|>` steers prosody across all 9 spoken languages without leaking
 * instruction words into the synthesized English/multilingual audio.
 */
const COSYVOICE_TONE_INSTRUCT_MAP: Record<string, CosyVoiceInstructOption> = {
  // Speaking Tones & Cue Styles
  // "Please speak a sentence with a smiling face and a gentle, affectionate tone."
  "warm & smiling": "请用面带微笑、温柔亲切的语气说一句话。",
  warm: "请用面带微笑、温柔亲切的语气说一句话。",
  smiling: "请用面带微笑、温柔亲切的语气说一句话。",
  smile: "请用面带微笑、温柔亲切的语气说一句话。",

  // "Please speak a sentence in a burst of happy laughter, unable to hold back a laugh while speaking."
  laugh: "请用开心大笑、忍俊不禁、边笑边说的语气说一句话。",
  laughing: "请用开心大笑、忍俊不禁、边笑边说的语气说一句话。",

  // "Please speak a sentence with heightened vocal stress and clear emphasis on key points."
  raise: "请用加重语气、清晰强调重点的语调说一句话。",
  emphasis: "请用加重语气、清晰强调重点的语调说一句话。",

  // "Please let out a gentle sigh and speak a sentence in a soft, reflective tone."
  sigh: "请轻轻叹一口气，用柔和感慨的语气说一句话。",

  // "Please speak a sentence with a surprised gasp and astonished tone."
  gasp: "请用惊讶、倒吸一口气的语气说一句话。",

  // "Please speak a sentence in a calm, engaging, and expressive storytelling narration tone."
  storyteller: "请用沉稳、娓娓道来、富有感染力的旁白叙事语气说一句话。",
  narration: "请用沉稳、娓娓道来、富有感染力的旁白叙事语气说一句话。",

  // "Please speak a sentence in a gentle, considerate, empathetic, and comforting tone."
  empathetic: "请用温柔、体贴、充满共情与安慰的语气说一句话。",

  // Native QVAC soft-volume instruction ("请用尽可能小声地悄悄说一句话。" -> "Please whisper a sentence as softly as possible.")
  "soft & hushed": { volume: "soft" },
  whisper: { volume: "soft" },
  soft: { volume: "soft" },

  // Native QVAC loud-volume instruction ("请尽可能非常大声地说一句话。" -> "Please speak a sentence as loudly as possible.")
  "projecting & loud": { volume: "loud" },
  loud: { volume: "loud" },
  yell: { volume: "loud" },

  // "Please speak a sentence in a clear, composed, professional podcast and news broadcast host tone."
  broadcast: "请用清晰、沉稳、专业的播客与新闻主持语气说一句话。",
  news: "请用清晰、沉稳、专业的播客与新闻主持语气说一句话。",

  // Extended Emotions
  // "Please speak a sentence in a firm, authoritative, and decisive commanding tone."
  command: "请用坚定、威严、果断的命令语气说一句话。",

  // "Please speak a sentence in a tone full of surprise and pleasant amazement."
  surprise: "请用充满惊讶和惊喜的语气说一句话。",

  // "Please speak a sentence in a tense, fearful, and slightly trembling voice."
  fear: "请用紧张、害怕、声音微颤的语气说一句话。",

  // "Please speak a sentence in a disdainful and displeased tone."
  disgust: "请用嫌弃、不满的语气说一句话。",

  // "Please speak a sentence with crisp, clear articulation and precise enunciation."
  "proper noun": "请用吐字清晰、字正腔圆的语气说一句话。",
};

/**
 * Translates English UI preset prompts and free-form English descriptions into
 * CosyVoice 3's native trained instruction vocabulary (`"请用...说一句话。"`) so
 * English prompts written by the user reliably steer the model's prosody.
 */
function normalizeCustomVoicePrompt(prompt: string): CosyVoiceInstructOption {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();

  // If the user already wrote a Chinese instruction (e.g. "请用..."), pass it through directly
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed;
  }

  // Volume / Whisper / Loud
  if (
    lower.includes("very soft voice") ||
    lower.includes("whisper") ||
    lower.includes("hushed") ||
    lower.includes("quietly") ||
    lower === "soft"
  ) {
    return { volume: "soft" };
  }
  if (
    lower.includes("loudly as possible") ||
    lower.includes("shout") ||
    lower.includes("yell") ||
    lower.includes("projecting") ||
    lower === "loud"
  ) {
    return { volume: "loud" };
  }

  // Robot / Style
  if (lower.includes("robot") || lower.includes("robotic") || lower.includes("mechanical")) {
    return { style: "robot" };
  }

  // Laughing / Chuckling / Amused
  if (
    lower.includes("laugh") ||
    lower.includes("chuckl") ||
    lower.includes("giggl") ||
    lower.includes("amused")
  ) {
    return COSYVOICE_TONE_INSTRUCT_MAP.laugh;
  }

  // Smiling / Warm / Friendly
  if (
    lower.includes("smile") ||
    lower.includes("smiling") ||
    lower.includes("warm") ||
    lower.includes("friendly") ||
    lower.includes("approachable")
  ) {
    return COSYVOICE_TONE_INSTRUCT_MAP["warm & smiling"];
  }

  // Sad / Emotional Tears / Melancholic
  if (
    lower.includes("sad") ||
    lower.includes("tear") ||
    lower.includes("cry") ||
    lower.includes("heartbroken") ||
    lower.includes("somber") ||
    lower.includes("melanchol") ||
    lower.includes("grief")
  ) {
    // "Please speak a sentence in as sad and heartbroken a tone as possible."
    return "请用尽可能伤心、难过的语气说一句话。";
  }

  // Angry / Furious / Intense
  if (
    lower.includes("angr") ||
    lower.includes("anger") ||
    lower.includes("furious") ||
    lower.includes("mad") ||
    lower.includes("outrage")
  ) {
    // "Please speak a sentence in as angry and furious a tone as possible."
    return "请用尽可能生气、愤怒的语气说一句话。";
  }

  // Happy / Joyful / Excited / Upbeat
  if (
    lower.includes("happy") ||
    lower.includes("joy") ||
    lower.includes("excit") ||
    lower.includes("cheerful") ||
    lower.includes("upbeat") ||
    lower.includes("enthusias")
  ) {
    // "Please speak a sentence in as happy and excited a tone as possible."
    return "请用尽可能开心、兴奋的语气说一句话。";
  }

  // Fear / Nervous / Scared / Trembling
  if (
    lower.includes("fear") ||
    lower.includes("scared") ||
    lower.includes("nervous") ||
    lower.includes("trembl") ||
    lower.includes("anxious") ||
    lower.includes("terrified")
  ) {
    return COSYVOICE_TONE_INSTRUCT_MAP.fear;
  }

  // Surprise / Amazed / Shocked
  if (
    lower.includes("surpris") ||
    lower.includes("amaz") ||
    lower.includes("shock") ||
    lower.includes("astonish")
  ) {
    return COSYVOICE_TONE_INSTRUCT_MAP.surprise;
  }

  // Authoritative / Commanding / Firm
  if (
    lower.includes("authorit") ||
    lower.includes("command") ||
    lower.includes("firm") ||
    lower.includes("strict") ||
    lower.includes("decisive")
  ) {
    return COSYVOICE_TONE_INSTRUCT_MAP.command;
  }

  // Empathetic / Caring / Reassuring / Gentle
  if (
    lower.includes("empathet") ||
    lower.includes("caring") ||
    lower.includes("reassur") ||
    lower.includes("comfort") ||
    lower.includes("gentle") ||
    lower.includes("kind")
  ) {
    return COSYVOICE_TONE_INSTRUCT_MAP.empathetic;
  }

  // Storyteller / Narrator / Audiobook / Calm
  if (
    lower.includes("storytell") ||
    lower.includes("narrat") ||
    lower.includes("audiobook") ||
    lower.includes("calm")
  ) {
    return COSYVOICE_TONE_INSTRUCT_MAP.storyteller;
  }

  // Podcast / Broadcast / News / Host
  if (
    lower.includes("podcast") ||
    lower.includes("broadcast") ||
    lower.includes("news") ||
    lower.includes("anchor") ||
    lower.includes("host")
  ) {
    return COSYVOICE_TONE_INSTRUCT_MAP.broadcast;
  }

  // Sigh / Reflective
  if (lower.includes("sigh") || lower.includes("wistful") || lower.includes("reflective")) {
    return COSYVOICE_TONE_INSTRUCT_MAP.sigh;
  }

  // Fast / Slow pacing in prompt
  if (lower.includes("fast") || lower.includes("quick") || lower.includes("rapid") || lower.includes("urgent")) {
    return "请用尽可能快地语速说一句话。";
  }
  if (lower.includes("slow") || lower.includes("deliberate") || lower.includes("unhurried")) {
    return "请用尽可能慢地语速说一句话。";
  }

  return trimmed;
}

interface ResolvedCosyVoiceConditioning {
  loadInstruct?: CosyVoiceInstructOption;
  perCallEmotion?: "anger" | "happy" | "sad";
  perCallPace?: "slow" | "fast";
  conditioningLabel: string;
}

/**
 * Resolves the single non-conflicting conditioning control for a CosyVoice 3 synthesis call.
 *
 * CosyVoice 3 enforces a strict one-instruction-per-synthesis rule (`assertSingleCosyvoiceControl`):
 * - Setting `emotion: "neutral"` engages the flat instruct path ("请用正常平淡的语气说一句话。")
 *   and drops the reference voice's speech tokens (`promptSpeechTokens = 0`).
 * - Omitting `emotion`, `pace`, and `instruct` preserves the reference voice's speech tokens
 *   (`promptSpeechTokens > 0`) for maximum zero-shot naturalness and prosodic fidelity.
 */
function resolveCosyVoiceConditioning(params: {
  segTone?: "normal" | "whisper" | "yell" | "raise" | "smile" | "laugh";
  detectedCues?: string[];
  speakingTone?: string;
  emotion?: string;
  pace?: string;
  dialect?: string;
  customPrompt?: string;
}): ResolvedCosyVoiceConditioning {
  const segTone = params.segTone || "normal";
  const cues = params.detectedCues || [];
  const rawTone = (params.speakingTone || "").trim().toLowerCase();
  const rawEmotion = (params.emotion || "").trim().toLowerCase();
  const rawPace = (params.pace || "").trim().toLowerCase();
  const rawDialect = (params.dialect || "").trim().toLowerCase();
  const customPrompt = (params.customPrompt || "").trim();

  // 1. Pointed segment-level acoustic volume overrides (whisper / loud)
  // Note: Inline paralinguistic cues ([laugh], [laughter], [chuckle], [smile], [sigh],
  // [breath], [gasp], [cough], [raise]) are realized directly via CosyVoice 3's trained
  // paralinguistic token embeddings (IDs 151647..151662) in true zero-shot mode
  // (`promptSpeechTokens > 0` with `promptText`). Setting `loadInstruct` for those cues
  // would switch `qvac-tts.cpp` to `build_lm_prompt_instruct` (`promptSpeechTokens = 0`),
  // suppressing the acoustic paralinguistic tokens.
  if (segTone === "whisper" || cues.includes("whisper")) {
    return {
      loadInstruct: { volume: "soft" },
      conditioningLabel: "instruct:volume=soft",
    };
  }
  if (segTone === "yell" || cues.includes("yell")) {
    return {
      loadInstruct: { volume: "loud" },
      conditioningLabel: "instruct:volume=loud",
    };
  }

  // 2. Explicit user-written Voice Prompt (Instruction)
  if (customPrompt.length > 0) {
    const normalizedPrompt = normalizeCustomVoicePrompt(customPrompt);
    return {
      loadInstruct: normalizedPrompt,
      conditioningLabel: `instruct:custom(${customPrompt.slice(0, 32)})`,
    };
  }

  // 3. Explicit CosyVoice 3 regional dialect
  if (rawDialect && VALID_COSYVOICE_DIALECTS.has(rawDialect)) {
    return {
      loadInstruct: { dialect: rawDialect },
      conditioningLabel: `instruct:dialect=${rawDialect}`,
    };
  }

  // 4. Explicit Speaking Tone selection (when not 'natural' or 'conversational')
  if (rawTone && rawTone !== "natural" && rawTone !== "conversational") {
    const mappedToneInstruct = COSYVOICE_TONE_INSTRUCT_MAP[rawTone];
    if (mappedToneInstruct) {
      return {
        loadInstruct: mappedToneInstruct,
        conditioningLabel: `tone:${rawTone}`,
      };
    }
  }

  // 5. Emotion selection
  // Note: 'neutral' and 'conversation' intentionally stay on the unconditioned zero-shot path
  // so CosyVoice 3 keeps the reference audio's speech tokens (`promptSpeechTokens > 0`).
  if (rawEmotion && rawEmotion !== "neutral" && rawEmotion !== "conversation") {
    if (rawEmotion === "happy" || rawEmotion === "sad" || rawEmotion === "anger") {
      return {
        perCallEmotion: rawEmotion,
        conditioningLabel: `emotion:${rawEmotion}`,
      };
    }
    const mappedEmotionInstruct = COSYVOICE_TONE_INSTRUCT_MAP[rawEmotion];
    if (mappedEmotionInstruct) {
      return {
        loadInstruct: mappedEmotionInstruct,
        conditioningLabel: `emotion-instruct:${rawEmotion}`,
      };
    }
  }

  // 6. Pace selection ('slow' or 'fast'; 'moderate' disengages pace channel)
  if (rawPace === "slow" || rawPace === "fast") {
    return {
      perCallPace: rawPace,
      conditioningLabel: `pace:${rawPace}`,
    };
  }

  // 7. Default: True Zero-Shot Path (retains promptSpeechTokens for maximum naturalness)
  return {
    conditioningLabel: "zero-shot-natural",
  };
}

/**
 * CosyVoice 3's 16 trained paralinguistic token embeddings in `cosyvoice3-llm-q8_0.gguf`
 * (`lm/embed_tokens/weight` rows 151647..151662).
 *
 * Because `QwenTokenizer::load` in `qvac-tts.cpp` only registers 4 special tokens
 * (`<|endoftext|>`, `<|im_start|>`, `<|im_end|>`, `<|endofprompt|>`), literal tags like
 * `[laughter]` or `<laughter>` would be split on `[` / `<` by `QwenTokenizer::pretokenize`
 * and spoken aloud as the English word `"laughter"`.
 *
 * By mapping Private Use Area codepoints `U+E000..U+E00F` in our augmented `vocab.json`
 * and `merges.txt` (via GPT-2 byte-level BPE `"îĢ" + String.fromCodePoint(0x0122 + k)` and
 * `"ĠîĢ" + String.fromCodePoint(0x0122 + k)` -> `151647 + k`), each PUA character encodes
 * into the exact single paralinguistic token ID `151647..151662`!
 */
const COSYVOICE_PARALINGUISTIC_TOKENS = {
  BREATH: "\uE000", // 151647: [breath]
  STRONG_OPEN: "\uE001", // 151648: <strong>
  STRONG_CLOSE: "\uE002", // 151649: </strong>
  NOISE: "\uE003", // 151650: [noise]
  LAUGHTER: "\uE004", // 151651: [laughter]
  COUGH: "\uE005", // 151652: [cough]
  CLUCKING: "\uE006", // 151653: [clucking]
  ACCENT: "\uE007", // 151654: [accent]
  QUICK_BREATH: "\uE008", // 151655: [quick_breath]
  LAUGH_SPAN_OPEN: "\uE009", // 151656: <laughter>
  LAUGH_SPAN_CLOSE: "\uE00A", // 151657: </laughter>
  HISSING: "\uE00B", // 151658: [hissing]
  SIGH: "\uE00C", // 151659: [sigh]
  VOCALIZED_NOISE: "\uE00D", // 151660: [vocalized-noise]
  LIPSMACK: "\uE00E", // 151661: [lipsmack]
  MN: "\uE00F", // 151662: [mn]
} as const;

/**
 * Preprocesses conversational reaction cues ([smile], [laugh], [chuckle], [hmm], [sigh], [breath], [gasp])
 * and pointed tone manipulation tags ([whisper], [yell], [raise], [smile]...[/smile]) into
 * CosyVoice 3's native paralinguistic token codepoints (`U+E000..U+E00F` -> token IDs `151647..151662`).
 */
function processConversationalCues(
  text: string,
  initialTone: "normal" | "whisper" | "yell" | "raise" | "smile" | "laugh" = "normal"
): ProcessedSpeechResult {
  let cleaned = text;
  let tone = initialTone;
  const detectedCues: string[] = [];
  const T = COSYVOICE_PARALINGUISTIC_TOKENS;

  // 1. Pointed whisper / soft block
  if (tone === "whisper" || /\[(?:whisper|soft)\]/i.test(cleaned)) {
    tone = "whisper";
    detectedCues.push("whisper");
    cleaned = cleaned.replace(/\[\/?(?:whisper|soft)\]/gi, " ");
  }

  // 2. Pointed yell / loud block
  if (tone === "yell" || /\[(?:yell|shout|loud)\]/i.test(cleaned)) {
    tone = "yell";
    detectedCues.push("yell");
    cleaned = cleaned.replace(/\[\/?(?:yell|shout|loud)\]/gi, " ");
  }

  // 3. Smile spans & standalone [smile] cues:
  // Wrap smiled phrases in <laughter>...</laughter> paralinguistic span tokens (\uE009 ... \uE00A)
  // for warm, smiling vocal delivery without speaking any tag names aloud.
  if (tone === "smile" || /\[\/?smile\]/i.test(cleaned)) {
    if (tone === "normal") tone = "smile";
    detectedCues.push("smile");
    cleaned = cleaned.replace(
      /\[smile\]([\s\S]*?)\[\/smile\]/gi,
      (_m, inner) => ` ${T.LAUGH_SPAN_OPEN} ${String(inner).trim()} ${T.LAUGH_SPAN_CLOSE} `
    );
    if (/\[smile\]/i.test(cleaned)) {
      cleaned = cleaned.replace(/\[smile\]/gi, ` ${T.LAUGH_SPAN_OPEN} `);
      cleaned = `${cleaned} ${T.LAUGH_SPAN_CLOSE} `;
    }
    cleaned = cleaned.replace(/\[\/smile\]/gi, ` ${T.LAUGH_SPAN_CLOSE} `);
  }

  // 4. Laughter / Chuckle / Giggle cues:
  // Uses the exact paralinguistic token sequence (`\uE004 \uE009 <text> \uE00A`, i.e.,
  // `[laughter] <laughter> <text> </laughter>` -> tokens 151651, 151656, ..., 151657)
  // that produces realistic acoustic human laughter in zero-shot mode (`promptSpeechTokens > 0`).
  if (
    tone === "laugh" ||
    /\[\/?(?:laugh|laughter|giggle|chuckle)\]/i.test(cleaned) ||
    /<\/?laughter>/i.test(cleaned)
  ) {
    if (tone === "normal") tone = "laugh";
    detectedCues.push("laugh");

    // Paired [laugh]...[/laugh] or <laughter>...</laughter>
    cleaned = cleaned.replace(
      /\[(?:laugh|laughter|giggle|chuckle)\]([\s\S]*?)\[\/(?:laugh|laughter|giggle|chuckle)\]/gi,
      (_m, inner) => ` ${T.LAUGHTER} ${T.LAUGH_SPAN_OPEN} ${String(inner).trim()} ${T.LAUGH_SPAN_CLOSE} `
    );
    cleaned = cleaned.replace(
      /<laughter>([\s\S]*?)<\/laughter>/gi,
      (_m, inner) => ` ${T.LAUGHTER} ${T.LAUGH_SPAN_OPEN} ${String(inner).trim()} ${T.LAUGH_SPAN_CLOSE} `
    );

    // Standalone [laugh] / [laughter] followed by a phrase/sentence:
    // Wrap the following clause in `\uE004 \uE009 <clause> \uE00A` (the exact pattern
    // `" \uE004 \uE009 You are not serious! \uE00A"` verified with Ashley's voice)
    cleaned = cleaned.replace(
      /\[(?:laugh|laughter)\]\s*([^.!?\n\uE000-\uE00F]+[.!?]?)/gi,
      (_m, phrase) => ` ${T.LAUGHTER} ${T.LAUGH_SPAN_OPEN} ${String(phrase).trim()} ${T.LAUGH_SPAN_CLOSE} `
    );

    // Any remaining standalone [laugh] / [laughter] / [chuckle] / [giggle]
    cleaned = cleaned.replace(/\[(?:laugh|laughter|giggle|chuckle)\]/gi, ` ${T.LAUGHTER} `);
    cleaned = cleaned.replace(/\[\/(?:laugh|laughter|giggle|chuckle)\]/gi, ` ${T.LAUGH_SPAN_CLOSE} `);
    cleaned = cleaned.replace(/<laughter>/gi, ` ${T.LAUGH_SPAN_OPEN} `);
    cleaned = cleaned.replace(/<\/laughter>/gi, ` ${T.LAUGH_SPAN_CLOSE} `);
  }

  // 5. Emphasis / Pitch Raise (`[raise]...[/raise]` / `[emphasis]` / `<strong>...</strong>`):
  // Maps to CosyVoice 3's trained `<strong>` (\uE001, 151648) and `</strong>` (\uE002, 151649) tokens.
  if (tone === "raise" || /\[\/?(?:raise|emphasis)\]/i.test(cleaned) || /<\/?strong>/i.test(cleaned)) {
    if (tone === "normal") tone = "raise";
    detectedCues.push("raise");
    cleaned = cleaned.replace(
      /\[(?:raise|emphasis)\]([\s\S]*?)\[\/(?:raise|emphasis)\]/gi,
      (_m, inner) => ` ${T.STRONG_OPEN} ${String(inner).trim()} ${T.STRONG_CLOSE} `
    );
    cleaned = cleaned.replace(
      /<strong>([\s\S]*?)<\/strong>/gi,
      (_m, inner) => ` ${T.STRONG_OPEN} ${String(inner).trim()} ${T.STRONG_CLOSE} `
    );
    cleaned = cleaned.replace(/\[(?:raise|emphasis)\]/gi, ` ${T.STRONG_OPEN} `);
    cleaned = cleaned.replace(/\[\/(?:raise|emphasis)\]/gi, ` ${T.STRONG_CLOSE} `);
    cleaned = cleaned.replace(/<strong>/gi, ` ${T.STRONG_OPEN} `);
    cleaned = cleaned.replace(/<\/strong>/gi, ` ${T.STRONG_CLOSE} `);
  }

  // 6. Breath, Quick Breath / Gasp, Sigh, Cough, Hmm / Mn, Lipsmack:
  // Maps directly to CosyVoice 3's trained paralinguistic tokens.
  if (/\[quick_breath\]/i.test(cleaned)) {
    detectedCues.push("breath");
    cleaned = cleaned.replace(/\[quick_breath\]/gi, ` ${T.QUICK_BREATH} `);
  }

  if (/\[breath\]/i.test(cleaned) || /<\/?breath>/i.test(cleaned)) {
    detectedCues.push("breath");
    cleaned = cleaned.replace(/<\/?breath>/gi, ` ${T.BREATH} `);
    cleaned = cleaned.replace(/\[breath\]/gi, ` ${T.BREATH} `);
  }

  if (/\[sigh\]/i.test(cleaned) || /<\/?sigh>/i.test(cleaned)) {
    detectedCues.push("sigh");
    cleaned = cleaned.replace(/<\/?sigh>/gi, ` ${T.SIGH} `);
    cleaned = cleaned.replace(/\[sigh\]/gi, ` ${T.SIGH} `);
  }

  if (/\[gasp\]/i.test(cleaned) || /<\/?gasp>/i.test(cleaned)) {
    detectedCues.push("gasp");
    cleaned = cleaned.replace(/<\/?gasp>/gi, ` ${T.QUICK_BREATH} `);
    cleaned = cleaned.replace(/\[gasp\]/gi, ` ${T.QUICK_BREATH} `);
  }

  if (/\[cough\]/i.test(cleaned)) {
    detectedCues.push("cough");
    cleaned = cleaned.replace(/\[cough\]/gi, ` ${T.COUGH} `);
  }

  if (/\[lipsmack\]/i.test(cleaned)) {
    detectedCues.push("lipsmack");
    cleaned = cleaned.replace(/\[lipsmack\]/gi, ` ${T.LIPSMACK} `);
  }

  if (/\[(?:hmm+|thinking|mn)\]/i.test(cleaned)) {
    detectedCues.push("hmm");
    cleaned = cleaned.replace(/\[(?:hmm+|thinking|mn)\]/gi, ` ${T.MN} `);
  }

  // 7. Safety sweep: strip any remaining XML or square-bracket control tags so QwenTokenizer
  // never pronounces a tag name as a literal word, then ensure every paralinguistic token
  // (`\uE000..\uE00F`) is surrounded by spaces so `QwenTokenizer::pretokenize` isolates it.
  cleaned = cleaned
    .replace(/<\/?[a-z0-9_-]+>/gi, " ")
    .replace(/\[\/?[a-z0-9_\s.-]+\]/gi, " ")
    .replace(/([\uE000-\uE00F])/g, " $1 ")
    .replace(/--+/g, " — ")
    .replace(/\.{4,}/g, "...")
    .replace(/(?:\.\.\.\s*){2,}/g, "... ")
    .replace(/([!?]){2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  // If the text starts or ends with a paralinguistic token, keep a leading/trailing space
  // so `QwenTokenizer::pretokenize` always sees `"ĠîĢ..."` and merges to a single token ID.
  if (/^[\uE000-\uE00F]/.test(cleaned)) {
    cleaned = ` ${cleaned}`;
  }

  // For whispered segments, prepend a gentle ellipsis pause for natural breath onset
  if (tone === "whisper" && cleaned.length > 0 && !cleaned.trimStart().startsWith("...")) {
    cleaned = `... ${cleaned.trimStart()}`;
  }

  // For yelled/projected segments, ensure energetic terminal punctuation
  if (tone === "yell" && cleaned.length > 0) {
    if (!/[!?\uE000-\uE00F]$/.test(cleaned.trimEnd())) {
      cleaned = `${cleaned.trimEnd()}!`;
    }
  }

  return { cleanedText: cleaned, detectedCues, tone };
}

/**
 * Ensures a synthesized sentence chunk ends with natural terminal punctuation while
 * preserving leading/trailing spaces around paralinguistic tokens (`\uE000..\uE00F`).
 */
function ensureNaturalSentencePunctuation(chunkText: string): string {
  const trimmed = chunkText.trim();
  if (!trimmed) return trimmed;

  // Strip any trailing paralinguistic tokens temporarily to check punctuation on the last spoken word
  const trailingTokensMatch = trimmed.match(/((?:\s*[\uE000-\uE00F])+)$/);
  const body = trailingTokensMatch
    ? trimmed.slice(0, trimmed.length - trailingTokensMatch[0].length).trim()
    : trimmed;
  const trailingTokens = trailingTokensMatch ? trailingTokensMatch[0].replace(/([\uE000-\uE00F])/g, " $1 ") : "";

  let punctuatedBody = body;
  if (punctuatedBody && !/[.!?。！？…;:,—-\uE000-\uE00F]$/.test(punctuatedBody)) {
    punctuatedBody = `${punctuatedBody}.`;
  }

  let result = `${punctuatedBody} ${trailingTokens}`.replace(/([\uE000-\uE00F])/g, " $1 ").replace(/\s+/g, " ").trim();
  // Always prefix with a single space if the chunk contains paralinguistic tokens so
  // `QwenTokenizer::pretokenize` binds the leading space (`Ġ`) to any initial token.
  if (/[\uE000-\uE00F]/.test(result)) {
    result = ` ${result}`;
  }
  return result;
}

interface SpeechChunk {
  text: string;
  isSentenceEnd: boolean;
}

/**
 * Splits speech text into natural, flowing sentence chunks (up to ~36 words / ~14-16s).
 * Avoids breaking within single sentences unless a sentence is extraordinarily long (>38 words).
 * Keeps prosody and intonation natural and unbroken.
 */
function splitSpeechIntoSentences(text: string, targetMaxWords = 36): SpeechChunk[] {
  const trimmedText = text.trim();
  if (!trimmedText) return [];

  const words = trimmedText.split(/\s+/).filter(Boolean);
  if (words.length <= targetMaxWords) {
    const isEnd = /[.!?]$/.test(trimmedText);
    return [{ text: trimmedText, isSentenceEnd: isEnd }];
  }

  // Split along sentence terminators (. ! ? or newline)
  const sentenceMatches = trimmedText.match(/[^.!?\n]+([.!?\n]+|$)/g) || [trimmedText];
  const chunks: SpeechChunk[] = [];
  let currentText = "";

  for (const s of sentenceMatches) {
    const sTrimmed = s.trim();
    if (!sTrimmed) continue;

    const candidate = currentText ? `${currentText} ${sTrimmed}` : sTrimmed;
    const candidateWords = candidate.split(/\s+/).filter(Boolean).length;

    if (candidateWords <= targetMaxWords) {
      currentText = candidate;
    } else {
      if (currentText) {
        const isEnd = /[.!?]$/.test(currentText.trim());
        chunks.push({ text: currentText.trim(), isSentenceEnd: isEnd });
      }

      // If a single standalone sentence is massive (>38 words without a period):
      const sWords = sTrimmed.split(/\s+/).filter(Boolean).length;
      if (sWords > targetMaxWords) {
        const clauseMatches = sTrimmed.match(/[^,;:—-]+([,;:—-]+|$)/g) || [sTrimmed];
        let subText = "";
        for (const cl of clauseMatches) {
          const clTrim = cl.trim();
          if (!clTrim) continue;
          const subCandidate = subText ? `${subText} ${clTrim}` : clTrim;
          const subWords = subCandidate.split(/\s+/).filter(Boolean).length;
          if (subWords <= targetMaxWords) {
            subText = subCandidate;
          } else {
            if (subText) {
              chunks.push({ text: subText.trim(), isSentenceEnd: false });
            }
            subText = clTrim;
          }
        }
        currentText = subText ? subText.trim() : "";
      } else {
        currentText = sTrimmed;
      }
    }
  }

  if (currentText.trim()) {
    const isEnd = /[.!?]$/.test(currentText.trim());
    chunks.push({ text: currentText.trim(), isSentenceEnd: isEnd });
  }

  return chunks.filter((c) => c.text.length > 0);
}

function parseTextAndPauses(rawText: string): TextOrPauseSegment[] {
  // Conversational micro-pauses (<= 1.2s) should NOT chop up the speech utterance.
  // Converting micro-pauses into ellipses ('... ') lets the model naturally pause and breathe.
  let text = rawText.replace(
    /\[pause\s*([0-9.]+)\s*(?:s|sec|seconds)?\]/gi,
    (fullMatch, secStr) => {
      const sec = parseFloat(secStr);
      if (Number.isFinite(sec) && sec <= 1.2) {
        return "... ";
      }
      return fullMatch;
    }
  );

  // Clean empty wrapper tags like [whisper][/whisper] or [smile][/smile]
  text = text.replace(
    /\[(whisper|soft|yell|shout|loud|raise|emphasis|smile|laugh|laughter|chuckle|giggle)\]\s*\[\/\1\]/gi,
    ""
  );

  // Split explicit long pauses (> 1.2s) and pointed volume wrapper spans
  // ([whisper]...[/whisper], [yell]...[/yell]) into dedicated speech segments.
  // Paralinguistic spans ([laugh]...[/laugh], [smile]...[/smile], [raise]...[/raise])
  // are kept inline inside the sentence so CosyVoice 3's paralinguistic tokens
  // (\uE000..\uE00F -> 151647..151662) flow naturally without chopping the utterance.
  const TOKEN_REGEX =
    /\[pause\s*([0-9.]+)\s*(?:s|sec|seconds)?\]|\[(whisper|soft|yell|shout|loud)\]([\s\S]*?)\[\/\2\]/gi;
  const segments: TextOrPauseSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index).trim();
    if (textBefore) {
      segments.push({ type: "speech", text: textBefore, tone: "normal" });
    }

    if (match[1] !== undefined) {
      const pauseSec = parseFloat(match[1]);
      if (Number.isFinite(pauseSec) && pauseSec > 0) {
        segments.push({ type: "pause", pauseSec: Math.min(pauseSec, 30) });
      }
    } else if (match[2] !== undefined) {
      const toneTag = match[2].toLowerCase();
      const content = (match[3] || "").trim();
      if (content) {
        let tone: "normal" | "whisper" | "yell" | "raise" | "smile" | "laugh" = "normal";
        if (toneTag === "whisper" || toneTag === "soft") tone = "whisper";
        else if (toneTag === "yell" || toneTag === "shout" || toneTag === "loud") tone = "yell";
        segments.push({ type: "speech", text: content, tone });
      }
    }
    lastIndex = match.index + match[0].length;
  }

  const textAfter = text.slice(lastIndex).trim();
  if (textAfter) {
    segments.push({ type: "speech", text: textAfter, tone: "normal" });
  }

  return segments;
}

/**
 * Resolves a reference audio input (`echo-media://`, `file://`, `/voices/...`, relative path, or absolute path)
 * across development and packaged builds, and ensures it is converted to a 24kHz 16-bit mono PCM WAV file
 * on the real OS filesystem required by QVAC/dr_wav for CosyVoice 3 voice cloning and speaker embeddings.
 */
function prepareReferenceAudioWav(inputPath?: string): string | undefined {
  if (!inputPath || typeof inputPath !== "string") return undefined;

  let cleanedInput = inputPath.trim();
  if (cleanedInput.startsWith("echo-media://")) {
    const raw = decodeURIComponent(cleanedInput.replace(/^echo-media:\/\//, ""));
    cleanedInput = raw.startsWith("/") ? raw : `/${raw}`;
  } else if (cleanedInput.startsWith("file://")) {
    cleanedInput = decodeURIComponent(cleanedInput.replace(/^file:\/\//, ""));
  }

  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const publicDir = process.env.VITE_PUBLIC || path.join(process.cwd(), "public");
  const appPath = app ? app.getAppPath() : process.cwd();
  const userDataDir = app ? app.getPath("userData") : "";
  const relNoLeadingSlash = cleanedInput.replace(/^\.?\//, "");
  const relUnderVoices = relNoLeadingSlash.replace(/^voices\//, "");

  const candidatePaths: string[] = [
    cleanedInput,
    ...(resourcesPath
      ? [
          path.join(resourcesPath, "app.asar.unpacked", relNoLeadingSlash),
          path.join(resourcesPath, "app.asar.unpacked", "voices", relUnderVoices),
          path.join(resourcesPath, "app.asar.unpacked", "dist", relNoLeadingSlash),
          path.join(resourcesPath, "voices", relUnderVoices),
        ]
      : []),
    ...(userDataDir
      ? [
          path.join(userDataDir, relNoLeadingSlash),
          path.join(userDataDir, "voices", relUnderVoices),
        ]
      : []),
    path.join(publicDir, relNoLeadingSlash),
    path.join(appPath, "dist", relNoLeadingSlash),
    path.join(appPath, "public", relNoLeadingSlash),
    path.resolve(process.cwd(), "public", relNoLeadingSlash),
    path.resolve(process.cwd(), cleanedInput),
  ];

  let resolved: string | undefined;
  for (const candidate of candidatePaths) {
    try {
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        resolved = candidate;
        break;
      }
    } catch {
      // ignore
    }
  }

  if (!resolved) return undefined;

  const cacheDir = path.join(os.tmpdir(), "echo-voice-cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  // If the file resides inside an .asar archive, extract it to cacheDir first so external
  // binaries (afconvert) and native C++/Bare workers (@qvac/sdk) can read it from disk.
  if (resolved.includes(".asar")) {
    try {
      const extInAsar = path.extname(resolved).toLowerCase() || ".mp3";
      const extractedPath = path.join(cacheDir, `asar_${path.basename(resolved, extInAsar)}${extInAsar}`);
      if (!fs.existsSync(extractedPath)) {
        const data = fs.readFileSync(resolved);
        fs.writeFileSync(extractedPath, data);
      }
      resolved = extractedPath;
    } catch (err) {
      console.warn(`[Echo Voice Engine] Failed to extract ${resolved} from asar:`, err);
      return undefined;
    }
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext === ".wav") return resolved;

  const stat = fs.statSync(resolved);
  const outName = `${path.basename(resolved, ext)}_${stat.size}_${Math.floor(stat.mtimeMs)}.wav`;
  const outPath = path.join(cacheDir, outName);

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
    return outPath;
  }

  // Convert on macOS using native CoreAudio afconvert
  try {
    execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@24000", "-c", "1", resolved, outPath]);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
      return outPath;
    }
  } catch (err) {
    console.warn(`[Echo Voice Engine] Audio conversion failed for ${resolved}:`, err);
  }

  return undefined;
}

/**
 * Gets a valid WAV reference for CosyVoice 3 voice cloning.
 * Returns undefined if no custom reference was provided so that
 * CosyVoice uses its high-quality native baked voice.
 */
function getValidReferenceWav(userProvidedSrc?: string): string | undefined {
  if (userProvidedSrc) {
    const converted = prepareReferenceAudioWav(userProvidedSrc);
    if (converted) return converted;
  }
  return undefined;
}

/**
 * Verbatim transcripts (`promptText`) for built-in preset voices and cloned custom voices.
 *
 * CRITICAL ENGINE REQUIREMENT (`qvac-tts.cpp` / `CosyVoicePipeline::setup_reference_voice`):
 * When `referenceAudioSrc` is passed WITHOUT `promptText`, `qvac-tts.cpp` falls back to
 * `no transcript: cross-lingual mode` and sets `promptSpeechTokens = 0` in the Qwen2.5 LLM!
 * When `promptText` IS provided (and `instruct` is undefined), `qvac-tts.cpp` runs in
 * TRUE zero-shot mode (`promptSpeechTokens > 0`), feeding all extracted reference speech
 * tokens into the LLM so paralinguistic tokens (`151647..151662`, e.g., `[laughter]`,
 * `<laughter>...</laughter>`) generate ultra-realistic human laughter in the speaker's voice.
 */
const REFERENCE_AUDIO_TRANSCRIPTS: Record<string, string> = {
  // Built-in English (US & UK)
  voice_en_male_1: "It is not so important to know everything as to appreciate what we learn.",
  "voice_en-gb_male_1": "It is not so important to know everything as to appreciate what we learn.",
  voice_en_male_2: "Love all, trust a few, do wrong to none.",
  "voice_en-gb_male_2": "Love all, trust a few, do wrong to none.",
  voice_en_male_3: "God has given you one face, and you make yourself another.",
  "voice_en-gb_male_3": "God has given you one face, and you make yourself another.",
  voice_en_male_4: "Life without love is like a tree without blossoms or fruit.",
  "voice_en-gb_male_4": "Life without love is like a tree without blossoms or fruit.",
  voice_en_male_5: "Friends show their love in times of trouble, not in happiness.",
  "voice_en-gb_male_5": "Friends show their love in times of trouble, not in happiness.",
  voice_en_female_1: "In the theater of life, we are all actors sharing the same scene.",
  "voice_en-gb_female_1": "In the theater of life, we are all actors sharing the same scene.",
  voice_en_female_2: "The years teach much which the days never know.",
  "voice_en-gb_female_2": "The years teach much which the days never know.",
  voice_en_female_3: "Our distrust is very expensive.",
  "voice_en-gb_female_3": "Our distrust is very expensive.",
  voice_en_female_4: "Just trust yourself, then you will know how to live.",
  "voice_en-gb_female_4": "Just trust yourself, then you will know how to live.",
  voice_en_female_5: "Ideas are the beginning points of all fortunes.",
  "voice_en-gb_female_5": "Ideas are the beginning points of all fortunes.",

  // Built-in Australian English (en-au)
  "voice_en-au_male_1": "Every sunrise brings a new chance to make memories.",
  "voice_en-au_male_2": "The night sky is a blanket stitched with stars.",
  "voice_en-au_male_3": "Water is my sanctuary, my solace, my escape.",
  "voice_en-au_male_4": "Fireworks paint the sky with bursts of colorful light.",
  "voice_en-au_male_5": "G'day, I'm Brandon. This is a quick sample of my voice. Easygoing, warm, and perfect for natural conversations.",
  "voice_en-au_female_1": "Movies bring the mighty dinosaurs back to life, captivating our hearts with ancient wonder.",
  "voice_en-au_female_2": "Movies bring the mighty dinosaurs back to life, captivating our hearts with ancient wonder.",
  "voice_en-au_female_3": "Hi, I'm Gabby. A warm, soft, and authentic voice for your next narration project. Let's get started.",
  "voice_en-au_female_4": "Cleanliness is the foundation upon which creativity builds its dreams.",
  "voice_en-au_female_5": "A curious cat may distract, but their purr inspires creativity.",

  // Built-in African English (en-af)
  "voice_en-af_male_1": "Success is the sum of small efforts, repeated day in and day out.",
  "voice_en-af_male_2": "Baking cookies fills the kitchen with warmth and love.",
  "voice_en-af_male_3": "Every dog has a heart made of gold.",
  "voice_en-af_male_4": "Airplanes take us high above, showing how change lifts us up.",
  "voice_en-af_male_5": "The spirit of the lion guides me in the hunt. I brave the dangers of the world for my people and my ancestors.",
  "voice_en-af_female_1": "History is a story written in the sands of time.",
  "voice_en-af_female_2": "Let your words be seeds of kindness and hope.",
  "voice_en-af_female_3": "Let the light of imagination guide your crafty hands.",
  "voice_en-af_female_4": "Stories are bridges built from imagination to understanding.",
  "voice_en-af_female_5": "In the wild realms, imagination finds its boundless wings.",

  // Custom & Cloned Voices (including Ashley)
  voice_preview_ashley:
    "Okay, here's your reminder to stop waiting for the perfect moment. Start small, have fun, and see where it takes you.",
  "voice_cloned-1793097051945_1793097051952":
    "Okay, here's your reminder to stop waiting for the perfect moment. Start small, have fun, and see where it takes you.",
  "voice_cloned-1793098898966_1793098898974":
    "Some voices aren't born, they're built. Crafted to tell stories that feel like they've always been there.",
  "voice_cloned-1793097155815_1793097155822":
    "Why can't your nose be twelve inches long? Because then it would be a foot.",
  "voice_cloned-1793097127465_1793097127471":
    "Hey, it's Tyler. A clean, high energy YouTube delivery that makes your script sound like a real creator, not a stiff voiceover.",
  "voice_cloned-1793100171467_1793100171474":
    "Um, okay, so this might sound silly, but I just got this weird sparkly feeling in my chest and I think, I think I'm actually falling in love.",
  "voice_cloned-1792960262139_1792960262148":
    "Um, okay, so this might sound silly, but I just got this weird sparkly feeling in my chest and I think, I think I'm actually falling in love.",
  "voice_cloned-1792771102919_1792771102930":
    "Um, okay, so this might sound silly, but I just got this weird sparkly feeling in my chest and I think, I think I'm actually falling in love.",
  "voice_cloned-1792762530859_1792762530871":
    "Um, okay, so this might sound silly, but I just got this weird sparkly feeling in my chest and I think, I think I'm actually falling in love.",
  "voice_cloned-1793097083205_1793097083213":
    "Hey everyone, so I just wanted to jump on here real quick. I've been getting a lot of questions lately about my skincare routine, and honestly, it's pretty simple. Consistency is key, you know? Plus, I'm always trying new things, so I'll probably do a full breakdown soon. Stay tuned for that, and remember to always be your amazing selves.",
  "voice_cloned-1793056611014_1793056611024":
    "Hey everyone, so I just wanted to jump on here real quick. I've been getting a lot of questions lately about my skincare routine, and honestly, it's pretty simple. Consistency is key, you know? Plus, I'm always trying new things, so I'll probably do a full breakdown soon. Stay tuned for that, and remember to always be your amazing selves.",
  "voice_cloned-1792772128388_1792772128399":
    "If you need an expressive voice for comedic gaming, animation, weird science, explainers, or just any other casual narration, this is the right voice.",
  "voice_cloned-1792757454181_1792757454192":
    "If you need an expressive voice for comedic gaming, animation, weird science, explainers, or just any other casual narration, this is the right voice.",
  "voice_cloned-1792771503498_1792771503510":
    "Every mirror in the house had broken during the night, except for the one in the hallway, and in it, something kept moving. But what was it?",
  "voice_cloned-1793097019385_1793097019392":
    "Wait, you're still scrolling? Creators, use this bright and sweet voice to give your reel the life it deserves.",
};

const REFERENCE_WAV_SIZE_TRANSCRIPTS: Record<number, string> = {
  379006:
    "Okay, here's your reminder to stop waiting for the perfect moment. Start small, have fun, and see where it takes you.",
  297504:
    "Some voices aren't born, they're built. Crafted to tell stories that feel like they've always been there.",
  219764: "Why can't your nose be twelve inches long? Because then it would be a foot.",
  409098:
    "Hey, it's Tyler. A clean, high energy YouTube delivery that makes your script sound like a real creator, not a stiff voiceover.",
  569594:
    "Um, okay, so this might sound silly, but I just got this weird sparkly feeling in my chest and I think, I think I'm actually falling in love.",
  954536:
    "Hey everyone, so I just wanted to jump on here real quick. I've been getting a lot of questions lately about my skincare routine, and honestly, it's pretty simple. Consistency is key, you know? Plus, I'm always trying new things, so I'll probably do a full breakdown soon. Stay tuned for that, and remember to always be your amazing selves.",
  466776:
    "If you need an expressive voice for comedic gaming, animation, weird science, explainers, or just any other casual narration, this is the right voice.",
  485586:
    "Every mirror in the house had broken during the night, except for the one in the hallway, and in it, something kept moving. But what was it?",
};

function resolveReferencePromptText(userProvidedSrc?: string, refWavPath?: string): string | undefined {
  const candidates = [userProvidedSrc, refWavPath].filter((x): x is string => Boolean(x));

  for (const candidate of candidates) {
    // 1. Check for a sidecar .txt transcript next to the audio file
    try {
      const ext = path.extname(candidate);
      const txtCandidate = ext ? `${candidate.slice(0, -ext.length)}.txt` : `${candidate}.txt`;
      if (fs.existsSync(txtCandidate)) {
        const text = fs.readFileSync(txtCandidate, "utf8").trim();
        if (text) return text;
      }
    } catch {}

    // 2. Match against known preset or custom voice filenames
    const base = path.basename(candidate, path.extname(candidate));
    if (REFERENCE_AUDIO_TRANSCRIPTS[base]) {
      return REFERENCE_AUDIO_TRANSCRIPTS[base];
    }
    for (const [key, transcript] of Object.entries(REFERENCE_AUDIO_TRANSCRIPTS)) {
      if (base.startsWith(key)) {
        return transcript;
      }
    }
  }

  // 3. Match by WAV byte size for cloned custom voices
  if (refWavPath) {
    try {
      const size = fs.statSync(refWavPath).size;
      if (REFERENCE_WAV_SIZE_TRANSCRIPTS[size]) {
        return REFERENCE_WAV_SIZE_TRANSCRIPTS[size];
      }
    } catch {}
  }

  return undefined;
}

/**
 * Creates a non-destructive companion model set directory in `os.tmpdir()` with symlinks to
 * the user's downloaded CosyVoice 3 GGUF files (`~/.qvac/models/sets/...`) and an augmented
 * `vocab.json` + `merges.txt` that maps Private Use Area characters `U+E000..U+E00F` to
 * CosyVoice 3's 16 trained paralinguistic token IDs (`151647..151662`).
 *
 * Keeping the original `~/.qvac/models/sets/...` files untouched preserves QVAC registry
 * SHA-256 and byte-size checks while allowing `loadModel({ modelSrc: localLlmPath })` to load
 * the paralinguistic vocabulary directly from disk.
 */
let cachedParalinguisticLlmPath: string | undefined;

function ensureParalinguisticCompanionModelPath(): string | undefined {
  if (cachedParalinguisticLlmPath && fs.existsSync(cachedParalinguisticLlmPath)) {
    return cachedParalinguisticLlmPath;
  }

  try {
    const setsRoot = path.join(os.homedir(), ".qvac", "models", "sets");
    if (!fs.existsSync(setsRoot)) return undefined;

    let origSetDir: string | undefined;
    let llmFilename = "cosyvoice3-llm-q8_0.gguf";

    const preferredDir = path.join(setsRoot, "b75e001ce19bae4c");
    if (
      fs.existsSync(path.join(preferredDir, "cosyvoice3-llm-q8_0.gguf")) &&
      fs.existsSync(path.join(preferredDir, "vocab.json")) &&
      fs.existsSync(path.join(preferredDir, "merges.txt"))
    ) {
      origSetDir = preferredDir;
    } else {
      for (const entry of fs.readdirSync(setsRoot)) {
        const candidateDir = path.join(setsRoot, entry);
        if (!fs.existsSync(path.join(candidateDir, "vocab.json"))) continue;
        if (fs.existsSync(path.join(candidateDir, "cosyvoice3-llm-q8_0.gguf"))) {
          origSetDir = candidateDir;
          llmFilename = "cosyvoice3-llm-q8_0.gguf";
          break;
        }
        if (fs.existsSync(path.join(candidateDir, "cosyvoice3-llm-q4_0.gguf"))) {
          origSetDir = candidateDir;
          llmFilename = "cosyvoice3-llm-q4_0.gguf";
          break;
        }
      }
    }

    if (!origSetDir) return undefined;

    const customSetDir = path.join(os.tmpdir(), "echo-voice-cache", "cosyvoice3-paralinguistic-v1");
    fs.mkdirSync(customSetDir, { recursive: true });

    for (const file of [
      llmFilename,
      "cosyvoice3-flow-f32.gguf",
      "cosyvoice3-hift-f32.gguf",
      "voice.gguf",
    ]) {
      const src = path.join(origSetDir, file);
      const dst = path.join(customSetDir, file);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.symlinkSync(src, dst);
      }
    }

    const dstVocab = path.join(customSetDir, "vocab.json");
    const dstMerges = path.join(customSetDir, "merges.txt");

    if (!fs.existsSync(dstVocab) || !fs.existsSync(dstMerges)) {
      const vocab = JSON.parse(fs.readFileSync(path.join(origSetDir, "vocab.json"), "utf8"));
      const mergesRaw = fs.readFileSync(path.join(origSetDir, "merges.txt"), "utf8");
      const mergesLines = mergesRaw.split("\n").filter((l) => l.trim().length > 0);
      const header = mergesLines[0].startsWith("#") ? [mergesLines[0]] : [];
      const body = mergesLines[0].startsWith("#") ? mergesLines.slice(1) : mergesLines;

      // In QwenTokenizer::build_byte_map (GPT-2 byte-to-unicode):
      // - 0x20 (space) -> U+0120 ('Ġ')
      // - 0xEE -> U+00EE ('î')
      // - 0x80 -> U+0122 ('Ģ', since 34 non-printable bytes precede 128: 256 + 34 = 290 = 0x0122)
      // - 0x80 + k (k=0..15) -> String.fromCodePoint(0x0122 + k) ('Ģ'..'ı')
      const extraMerges: string[] = ["î Ģ"];
      for (let k = 0; k < 16; k++) {
        const lastChar = String.fromCodePoint(0x0122 + k);
        const tokenNoSpace = `îĢ${lastChar}`;
        const tokenWithSpace = `ĠîĢ${lastChar}`;
        extraMerges.push(`îĢ ${lastChar}`);
        extraMerges.push(`Ġ ${tokenNoSpace}`);
        vocab[tokenNoSpace] = 151647 + k;
        vocab[tokenWithSpace] = 151647 + k;
      }

      fs.writeFileSync(dstVocab, JSON.stringify(vocab));
      fs.writeFileSync(dstMerges, [...header, ...body, ...extraMerges].join("\n") + "\n");
    }

    const llmPath = path.join(customSetDir, llmFilename);
    if (fs.existsSync(llmPath)) {
      cachedParalinguisticLlmPath = llmPath;
      return llmPath;
    }
  } catch (err) {
    console.warn("[Echo Voice Engine] Failed to prepare paralinguistic companion set:", err);
  }

  return undefined;
}

export class VoiceEngineService {
  private modelsService: ModelsService;
  private loadedModels: Map<string, string> = new Map();
  private activeTtsRequestIds: Map<string, string> = new Map();
  private mediaDestinationFolder?: string;
  private inferenceDevice: "gpu" | "cpu" = "gpu";

  constructor(modelsService?: ModelsService) {
    this.modelsService = modelsService || new ModelsService();
  }

  public setInferenceDevice(device: "gpu" | "cpu"): void {
    if (this.inferenceDevice !== device) {
      this.inferenceDevice = device;
      for (const modelId of this.loadedModels.values()) {
        try {
          (qvacSdk as any).unloadModel?.({ modelId });
        } catch {}
      }
      this.loadedModels.clear();
    }
  }

  public getInferenceDevice(): "gpu" | "cpu" {
    return this.inferenceDevice;
  }

  public setMediaDestinationFolder(dir: string): void {
    this.mediaDestinationFolder = dir;
  }

  public getMediaDestinationFolder(): string | undefined {
    return this.mediaDestinationFolder;
  }

  public getModelsService(): ModelsService {
    return this.modelsService;
  }

  /**
   * Scan disk cache directory for downloaded models
   */
  public syncCacheFromDisk(): void {
    this.modelsService.syncCacheFromDisk();
  }

  /**
   * Delete all installed models from disk and reset engine state
   */
  public async deleteAllModels(): Promise<boolean> {
    for (const modelId of this.loadedModels.values()) {
      try {
        await (qvacSdk as any).unloadModel?.({
          modelId,
        });
      } catch {}
    }
    this.loadedModels.clear();

    return this.modelsService.deleteAllModels();
  }

  /**
   * Get complete status of all voice engine models
   */
  public getStatus(selectedEngine?: "cosyvoice3"): VoiceModelStatusResult {
    return this.modelsService.getStatus(selectedEngine);
  }

  /**
   * Download a single model with live progress updates
   */
  public async downloadModel(
    modelId: string,
    onProgress?: (p: ModelDownloadProgressPayload) => void,
  ): Promise<{ success: boolean; modelId: string; error?: string }> {
    return this.modelsService.downloadModel(modelId, onProgress);
  }

  /**
   * Cancel an active model download
   */
  public cancelDownload(modelId: string): boolean {
    return this.modelsService.cancelDownload(modelId);
  }


  /**
   * Ensures the CosyVoice 3 engine is loaded with the configured device (GPU / CPU),
   * reference voice profile, and optional natural-language/structured `instruct` conditioning.
   *
   * Note: Basic emotions ('happy', 'sad', 'anger') and paces ('slow', 'fast') are applied
   * per-call in `textToSpeech()`, so the base zero-shot model (`instruct: undefined`) can
   * switch between Neutral (zero-shot), Happy, Sad, Anger, Slow, and Fast without reloading.
   */
  private async ensureModelLoaded(opts: {
    engine?: "cosyvoice3";
    language?: string;
    lavaSrEnabled?: boolean;
    instruct?: CosyVoiceInstructOption;
    referenceAudioSrc?: string;
    taskId: string;
    onProgress?: TtsProgressCallback;
    onLog?: TtsLogCallback;
  }): Promise<{ modelId: string; engine: "cosyvoice3" }> {
    const lavaSr = opts.lavaSrEnabled !== false && this.modelsService.isModelDownloaded("lavasr-enhancer");
    const lavasrSrc = (qvacSdk as any).TTS_ENHANCER_LAVASR_FP16;

    // CosyVoice 3
    const cosyvoiceDescriptor =
      (qvacSdk as any).TTS_COSYVOICE3_LLM_COSYVOICE_Q8_0 ||
      (qvacSdk as any).TTS_COSYVOICE3_LLM_COSYVOICE_Q4_0;

    if (!cosyvoiceDescriptor) {
      throw new Error("QVAC CosyVoice 3 descriptor missing from SDK");
    }

    const instruct =
      typeof opts.instruct === "string"
        ? opts.instruct.trim() || undefined
        : opts.instruct && typeof opts.instruct === "object"
          ? opts.instruct
          : undefined;

    const instructKey = instruct
      ? typeof instruct === "string"
        ? `str:${instruct}`
        : `obj:${JSON.stringify(instruct)}`
      : "zero-shot";

    let refWavPath = getValidReferenceWav(opts.referenceAudioSrc);
    if (!refWavPath) {
      // High quality default reference voice ensures CAM++ speaker encoder and S3Tok conditioning
      // are activated, avoiding muffled, noisy zero-shot unconditioned audio.
      const defaultCandidates = [
        "/voices/samples/en/voice_en_male_1.mp3",
        "/voices/samples/en/voice_en_female_1.mp3",
      ];
      for (const candidate of defaultCandidates) {
        refWavPath = prepareReferenceAudioWav(candidate);
        if (refWavPath) break;
      }
    }
    const hasCloningModels =
      (this.modelsService.isModelDownloaded("cosyvoice3-s3tok-fp16") ||
        this.modelsService.isModelDownloaded("cosyvoice3-s3tok")) &&
      (this.modelsService.isModelDownloaded("cosyvoice3-campplus-fp32") ||
        this.modelsService.isModelDownloaded("cosyvoice3-campplus"));

    const promptText =
      refWavPath && hasCloningModels
        ? resolveReferencePromptText(opts.referenceAudioSrc, refWavPath)
        : undefined;

    const paralinguisticModelSrc = ensureParalinguisticCompanionModelPath() || cosyvoiceDescriptor;

    console.log(
      `[Echo Voice Engine] CosyVoice 3 setup: refWavPath=${refWavPath}, hasCloningModels=${hasCloningModels}, hasPromptText=${Boolean(promptText)}, mode=${instructKey}, device=${this.inferenceDevice}`,
    );

    const key = [
      "cosyvoice3",
      refWavPath || "native",
      promptText ? "zero-shot-transcript" : "cross-lingual",
      instructKey,
      lavaSr ? "lavasr48k" : "native24k",
      this.inferenceDevice,
    ].join("|");

    const cachedModelId = this.loadedModels.get(key);
    if (cachedModelId) {
      return { modelId: cachedModelId, engine: "cosyvoice3" };
    }

    const voiceDesc = refWavPath ? ` voice="${path.basename(refWavPath)}"` : " (native studio voice)";
    const modeDesc = instruct ? ` instruct=${instructKey}` : " (zero-shot natural prosody)";
    const deviceLabel = this.inferenceDevice === "gpu" ? "GPU (Metal)" : "CPU";
    opts.onLog?.({
      text: `[Echo Voice Engine] Loading CosyVoice 3 Engine (0.5B Q8_0 [FP32 Flow Matching]${lavaSr ? " +LavaSR 48kHz" : ""}${voiceDesc}${modeDesc} [${deviceLabel}])...`,
      stream: "stdout",
    });

    const useGPU = this.inferenceDevice === "gpu";
    const baseConfig: any = {
      ttsEngine: "cosyvoice3",
      useGPU,
      seed: 42,
      ...(refWavPath && hasCloningModels
        ? {
            cosyvoice3S3tokModelSrc: (qvacSdk as any).TTS_COSYVOICE3_S3TOK_COSYVOICE_FP16,
            cosyvoice3CampplusModelSrc: (qvacSdk as any).TTS_COSYVOICE3_CAMPPLUS_COSYVOICE_FP32,
            referenceAudioSrc: refWavPath,
            ...(promptText ? { promptText } : {}),
          }
        : {}),
      ...(lavaSr && lavasrSrc
        ? { lavasrEnhancerModelSrc: lavasrSrc }
        : {}),
      ...(instruct ? { instruct } : {}),
    };

    const modelId = await (qvacSdk as any).loadModel({
      modelSrc: paralinguisticModelSrc,
      modelType: "tts",
      modelConfig: baseConfig,
      onProgress: (p: any) => {
        const pct = Math.round(p?.percentage ?? 0);
        opts.onProgress?.({
          taskId: opts.taskId,
          progress: Math.min(40, Math.round(pct * 0.4)),
          message: `Loading CosyVoice 3 weights ${pct}%...`,
          phase: "loading",
        });
      },
    });

    if (this.loadedModels.size >= 4) {
      const oldestKey = this.loadedModels.keys().next().value;
      if (oldestKey) {
        const oldId = this.loadedModels.get(oldestKey);
        if (oldId) {
          try {
            await (qvacSdk as any).unloadModel?.({ modelId: oldId });
          } catch {}
        }
        this.loadedModels.delete(oldestKey);
      }
    }

    this.loadedModels.set(key, modelId);
    return { modelId, engine: "cosyvoice3" };
  }

  public cancelSynthesis(taskId: string): void {
    const reqId = this.activeTtsRequestIds.get(taskId);
    if (reqId) {
      try {
        void (qvacSdk as any).cancel?.({ requestId: reqId });
      } catch {}
      this.activeTtsRequestIds.delete(taskId);
    }
  }

  /**
   * High-fidelity speech synthesis pipeline using CosyVoice 3
   * and optional Lava-SR 48kHz enhancement.
   */
  public async synthesize(
    options: TtsGenerateOptions,
    onProgress?: TtsProgressCallback,
    onLog?: TtsLogCallback,
    isCancelled?: () => boolean,
  ): Promise<TtsGenerateResult> {
    const { taskId, rounds } = options;
    const activeEngine = "cosyvoice3";
    const activeRounds = rounds.filter((r) => r.text.trim().length > 0);
    if (activeRounds.length === 0) {
      return { success: false, error: "No active speech rounds to synthesize" };
    }

    const firstRound = activeRounds[0];
    const speakerName = options.speakerName || "Selected Speaker";
    onLog?.({
      text: `[Echo Voice Engine] Synthesis task ${taskId} engine="cosyvoice3" voice="${speakerName}" device="${this.inferenceDevice}" turns=${activeRounds.length}...`,
      stream: "system",
    });

    try {
      if (isCancelled?.()) return { success: false, error: "Cancelled" };
      onProgress?.({
        taskId,
        progress: 8,
        message: "Loading CosyVoice 3 Engine...",
        phase: "loading",
      });

      const lavaSrEnabled = options.lavaSrEnabled !== false && this.modelsService.isModelDownloaded("lavasr-enhancer");
      const globalVoicePrompt =
        options.voicePrompt ||
        options.prompt ||
        options.description;

      if (isCancelled?.()) return { success: false, error: "Cancelled" };

      const allSamples: number[] = [];
      let sampleRate = lavaSrEnabled ? 48000 : 24000;
      const engine = activeEngine;

      for (let i = 0; i < activeRounds.length; i++) {
        if (isCancelled?.()) {
          const reqId = this.activeTtsRequestIds.get(taskId);
          if (reqId) {
            try {
              await (qvacSdk as any).cancel?.({ requestId: reqId });
            } catch {}
          }
          return { success: false, error: "Cancelled" };
        }

        const round = activeRounds[i];
        let roundRefAudio = round.referenceAudioSrc || options.referenceAudioSrc;
        if (!roundRefAudio) {
          roundRefAudio = "/voices/samples/en/voice_en_male_1.mp3";
        }

        onProgress?.({
          taskId,
          progress: 40 + Math.round((i / activeRounds.length) * 50),
          message: `Synthesizing turn ${i + 1}/${activeRounds.length}${round.speakerName ? ` (${round.speakerName})` : ''}...`,
          phase: "synthesis",
        });

        // Inter-turn natural spacing with studio acoustic floor
        if (i > 0 && allSamples.length > 0) {
          const prePause = round.prePauseMs
            ? Math.max(0.45, (round.prePauseMs + 200) / 1000)
            : 0.65;
          const interTurnSamples = generateAcousticRoomPause(prePause, sampleRate);
          crossfadeAppend(allSamples, interTurnSamples, sampleRate, 14);
        }

        // Parse explicit [pause X.Xs] cues and pointed volume blocks ([whisper], [yell])
        const segments = parseTextAndPauses(round.text);
        let speechSegCount = 0;

        for (let sIdx = 0; sIdx < segments.length; sIdx++) {
          const seg = segments[sIdx];
          if (isCancelled?.()) {
            const reqId = this.activeTtsRequestIds.get(taskId);
            if (reqId) {
              try {
                await (qvacSdk as any).cancel?.({ requestId: reqId });
              } catch {}
            }
            return { success: false, error: "Cancelled" };
          }

          if (seg.type === "pause" && seg.pauseSec) {
            const pauseSamples = generateAcousticRoomPause(seg.pauseSec, sampleRate);
            crossfadeAppend(allSamples, pauseSamples, sampleRate, 14);
            continue;
          }

          if (seg.type === "speech" && seg.text) {
            // Process cues & formatting for CosyVoice 3 native paralinguistic tags (<laughter>, <strong>, [breath], [sigh])
            const { cleanedText, detectedCues, tone: segTone } = processConversationalCues(seg.text, seg.tone);
            if (!cleanedText) continue;

            // Resolve non-conflicting conditioning for this segment
            const segmentConditioning = resolveCosyVoiceConditioning({
              segTone,
              detectedCues,
              speakingTone: round.speakingTone,
              emotion: round.emotion,
              pace: round.pace,
              dialect: round.dialect,
              customPrompt:
                round.prompt !== undefined ? round.prompt : globalVoicePrompt,
            });

            const { modelId: segmentModelId } = await this.ensureModelLoaded({
              engine: activeEngine,
              language: options.language || "en",
              lavaSrEnabled,
              instruct: segmentConditioning.loadInstruct,
              referenceAudioSrc: roundRefAudio,
              taskId,
              onProgress,
              onLog,
            });

            // Split into natural sentence chunks (up to 36 words / ~15s)
            // Keeping complete sentences intact so prosody, melody, and flow are never broken
            const sentenceChunks = splitSpeechIntoSentences(cleanedText, 36);

            for (let cIdx = 0; cIdx < sentenceChunks.length; cIdx++) {
              const chunkObj = sentenceChunks[cIdx];
              const chunkText = ensureNaturalSentencePunctuation(chunkObj.text);
              if (!chunkText) continue;

              if (isCancelled?.()) {
                const reqId = this.activeTtsRequestIds.get(taskId);
                if (reqId) {
                  try {
                    await (qvacSdk as any).cancel?.({ requestId: reqId });
                  } catch {}
                }
                return { success: false, error: "Cancelled" };
              }

              // Natural, human respiration and dramatic pause cadence:
              // - 0.14s for comma/clause mid-sentence pauses
              // - 0.36s between complete sentences (natural human breath pause)
              // - 0.26s between cue-tagged segments
              if (allSamples.length > 0) {
                const isMidSentence = cIdx > 0 && !sentenceChunks[cIdx - 1].isSentenceEnd;
                const pauseDuration = isMidSentence ? 0.14 : (cIdx > 0 ? 0.36 : 0.26);
                const interPause = generateAcousticRoomPause(pauseDuration, sampleRate);
                crossfadeAppend(allSamples, interPause, sampleRate, 12);
              }
              speechSegCount++;

              const ttsPayload: any = {
                modelId: segmentModelId,
                text: chunkText,
                inputType: "text",
                stream: false,
              };

              if (engine === "cosyvoice3" && !segmentConditioning.loadInstruct) {
                // Only set per-call emotion or pace when no load-time instruct is active,
                // and set at most ONE of emotion or pace to respect CosyVoice 3's single-instruction rule.
                if (segmentConditioning.perCallEmotion) {
                  ttsPayload.emotion = segmentConditioning.perCallEmotion;
                } else if (segmentConditioning.perCallPace) {
                  ttsPayload.pace = segmentConditioning.perCallPace;
                }
              }

              const result: any = (qvacSdk as any).textToSpeech(ttsPayload);

              if (result?.requestId)
                this.activeTtsRequestIds.set(taskId, result.requestId);
              const pcm: number[] = (await result.buffer) ?? [];
              const done = await result.done;
              const srValue = await result.sampleRate;
              const sr = typeof srValue === "number" && srValue > 0
                ? srValue
                : lavaSrEnabled ? 48000 : 24000;
              sampleRate = sr;
              this.activeTtsRequestIds.delete(taskId);

              // Debug: log raw PCM stats to diagnose noise issues
              if (pcm.length > 0) {
                let maxAbs = 0;
                let minVal = Infinity;
                let maxVal = -Infinity;
                for (const sample of pcm) {
                  const value = Number.isFinite(sample) ? sample : 0;
                  maxAbs = Math.max(maxAbs, Math.abs(value));
                  minVal = Math.min(minVal, value);
                  maxVal = Math.max(maxVal, value);
                }
                const allZero = pcm.every((s) => s === 0);
                const allSame = pcm.every((s) => s === pcm[0]);
                console.log(
                  `[TTS Debug] Turn ${i + 1} Chunk ${cIdx + 1}/${sentenceChunks.length}: PCM length=${pcm.length}, maxAbs=${maxAbs.toFixed(4)}, min=${minVal.toFixed(4)}, max=${maxVal.toFixed(4)}, allZero=${allZero}, allSame=${allSame}, sampleRate=${sr}`,
                );
              }

              // Save QVAC's raw output as a playable WAV file for inspection
              if (pcm.length > 0) {
                const safeLabel =
                  chunkText.replace(/[^a-z0-9]/gi, "_").slice(0, 30) ||
                  `round-${i}-chunk-${cIdx}`;
                savePcmAsWavFile(pcm, sr, `segment-${i}-${safeLabel}`);
              }

              if (!done || !pcm || pcm.length === 0) {
                throw new Error(
                  `CosyVoice 3 returned no audio for turn ${i + 1}`,
                );
              }

              // Trim model's dead air silence from head and tail (keeping natural pre/post roll)
              const trimmedPcm = trimPcmSilence(pcm, sr);

              // Seamless equal-power crossfade append into master buffer (12ms)
              crossfadeAppend(allSamples, trimmedPcm, sr, 12);
            }
          }
        }

        // Post-turn room tone spacing if specified
        if (round.postPauseMs && round.postPauseMs > 100) {
          const postPause = Math.min(1.2, round.postPauseMs / 1000);
          const postSamples = generateAcousticRoomPause(postPause, sampleRate);
          crossfadeAppend(allSamples, postSamples, sampleRate, 14);
        }
      }

      if (isCancelled?.()) return { success: false, error: "Cancelled" };
      onProgress?.({
        taskId,
        progress: 95,
        message: `Finalizing ${sampleRate}Hz WAV & waveform...`,
        phase: "finalizing",
      });

      // Save the final combined output for inspection and media folder export
      if (allSamples.length > 0) {
        savePcmAsWavFile(allSamples, sampleRate, "combined-output", this.mediaDestinationFolder);
      }

      const audioUrl = pcmToWavDataUri(allSamples, sampleRate);
      const waveform = computePeaks(allSamples, 38);
      const duration = Math.round((allSamples.length / sampleRate) * 10) / 10;

      const fullSnippet = activeRounds[0].text.trim();
      const textSnippet =
        fullSnippet.length > 55
          ? `${fullSnippet.slice(0, 52)}...`
          : fullSnippet;

      const output: TtsGenerationOutput = {
        id: `gen-${taskId}`,
        roundIndex: options.historyIndex || 0,
        title: `Generation ${(options.historyIndex || 0) + 1}`,
        textSnippet,
        speakerName:
          activeRounds.length > 1
            ? `${activeRounds.length} Speakers`
            : options.speakerName || "Sterling Rhodes",
        speakerColor:
          activeRounds.length > 1
            ? "#10b981"
            : options.speakerColor || "#38bdf8",
        speakerAvatarUrl:
          options.speakerAvatarUrl || "/voices/sterling.jpg",
        duration,
        audioUrl,
        waveform,
        timestamp: "Just now",
        emotion: firstRound.emotion || "Neutral",
      };

      onProgress?.({
        taskId,
        progress: 100,
        message: "CosyVoice 3 synthesis complete",
        phase: "complete",
      });

      onLog?.({
        text: `[Echo Voice Engine] Synthesis complete (${duration}s @ ${sampleRate}Hz, ${allSamples.length} samples).`,
        stream: "stdout",
      });

      return { success: true, data: output };
    } catch (err: any) {
      this.activeTtsRequestIds.delete(taskId);
      const msg = err?.message ? String(err.message) : String(err);
      onLog?.({
        text: `[Echo Voice Engine] Synthesis failed: ${msg}`,
        stream: "stderr",
      });
      return { success: false, error: msg };
    }
  }
}
