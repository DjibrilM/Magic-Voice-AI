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
  tone?: "normal" | "whisper" | "yell" | "raise";
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
  tone: "normal" | "whisper" | "yell" | "raise";
}

/**
 * Preprocesses conversational reaction cues ([laugh], [chuckle], [hmm], [sigh])
 * and pointed tone manipulation tags ([whisper], [yell], [raise]).
 *
 * For CosyVoice 3:
 * Translates cues to native FunAudioLLM instruct tags (<laughter>, <strong>, <breath>)
 * as specified in FunAudioLLM/CosyVoice #191, which work both in zero-shot base mode
 * and with custom cloned voices.
 */
function processConversationalCues(
  text: string,
  initialTone: "normal" | "whisper" | "yell" | "raise" = "normal"
): ProcessedSpeechResult {
  let cleaned = text;
  let tone = initialTone;
  const detectedCues: string[] = [];

  // Pointed tone detection
  if (tone === "whisper" || /\[(?:whisper|soft)\]/i.test(cleaned)) {
    tone = "whisper";
    detectedCues.push("whisper");
    cleaned = cleaned.replace(/\[\/?(?:whisper|soft)\]/gi, " ");
  }

  if (tone === "yell" || /\[(?:yell|shout|loud)\]/i.test(cleaned)) {
    tone = "yell";
    detectedCues.push("yell");
    cleaned = cleaned.replace(/\[\/?(?:yell|shout|loud)\]/gi, " ");
    const trimmed = cleaned.trim();
    const ending = /[!?]$/.test(trimmed) ? "" : "!";
    cleaned = `${trimmed.toUpperCase()}${ending}`;
  }

  if (tone === "raise" || /\[(?:raise|emphasis)\]/i.test(cleaned) || /<\/?strong>/i.test(cleaned)) {
    tone = "raise";
    detectedCues.push("raise");
  }

  // Strip laughter and chuckle tags cleanly so they do not cause repeats or glitchy audio
  cleaned = cleaned.replace(/\[\/?(?:laugh|laughter|giggle|chuckle)\]/gi, " ");
  cleaned = cleaned.replace(/<\/?laughter>/gi, " ");

  // Detect breath/sigh cues
  if (/\[(?:sigh|breath)\]/i.test(cleaned) || /<\/?breath>/i.test(cleaned)) {
    detectedCues.push("breath");
  }

  if (/\[(?:hmm+|thinking)\]/i.test(cleaned)) {
    detectedCues.push("hmm");
  }

  if (/\[gasp\]/i.test(cleaned)) {
    detectedCues.push("gasp");
  }

  // ----------------------------------------------------
  // CosyVoice 3: Native Instruct Tags (<strong>, <breath>)
  // ----------------------------------------------------

  // 1. Breath / Sigh:
  // Convert [breath] or [sigh] to native <breath>
  cleaned = cleaned.replace(/\[(?:breath|sigh)\]/gi, " <breath> ");

  // 2. Emphasis / Strong:
  // Convert wrapped [raise]...[/raise] or [emphasis]...[/emphasis] to <strong>...</strong>
  cleaned = cleaned.replace(
    /\[(?:raise|emphasis)\]([\s\S]*?)\[\/(?:raise|emphasis)\]/gi,
    "<strong>$1</strong>"
  );
  // If tone was raised or isolated [raise] is used, wrap with <strong> if not already wrapped
  if (tone === "raise" && !/<strong>[\s\S]*?<\/strong>/i.test(cleaned)) {
    cleaned = `<strong>${cleaned.trim()}</strong>`;
  }
  cleaned = cleaned.replace(/\[\/?(?:raise|emphasis)\]/gi, " ");

  // 3. Reactions:
  cleaned = cleaned.replace(/\[(?:hmm+|thinking)\]/gi, "Hmm... ");
  cleaned = cleaned.replace(/\[gasp\]/gi, "<breath> ");

  // Clean multiple consecutive duplicate tags or spaces
  cleaned = cleaned
    .replace(/(?:<breath>\s*)+<breath>/gi, "<breath>")
    .replace(/\s+/g, " ")
    .trim();

  // Pad whisper with gentle breath pauses
  if (tone === "whisper" && cleaned.length > 0) {
    cleaned = `<breath> ${cleaned.toLowerCase()} <breath>`;
  }

  return { cleanedText: cleaned, detectedCues, tone };
}

interface SpeechChunk {
  text: string;
  isSentenceEnd: boolean;
}

/**
 * Splits speech text into natural, flowing sentence chunks (up to ~36 words / ~14-16s).
 * Avoids breaking within single sentences unless a sentence is extraordinarily long (>38 words).
 * Keeps prosody and intonation natural and unbroken, and preserves XML tags without splitting them.
 */
function splitSpeechIntoSentences(text: string, targetMaxWords = 36): SpeechChunk[] {
  const trimmedText = text.trim();
  if (!trimmedText) return [];

  // Count words ignoring markup tags
  const cleanForWordCount = trimmedText.replace(/<\/?[a-z0-9_-]+>/gi, " ").trim();
  const words = cleanForWordCount.split(/\s+/).filter(Boolean);
  if (words.length <= targetMaxWords) {
    const isEnd = /[.!?]$/.test(cleanForWordCount);
    return [{ text: trimmedText, isSentenceEnd: isEnd }];
  }

  // Split along sentence terminators (. ! ? or newline) that don't occur inside an XML tag
  const sentenceMatches =
    trimmedText.match(/(?:<[^>]+>|[^.!?\n])+([.!?\n]+(?=[\s<]|$)|$)/g) || [trimmedText];
  const chunks: SpeechChunk[] = [];
  let currentText = "";

  for (const s of sentenceMatches) {
    const sTrimmed = s.trim();
    if (!sTrimmed) continue;

    const candidate = currentText ? `${currentText} ${sTrimmed}` : sTrimmed;
    const candidateWords = candidate.replace(/<\/?[a-z0-9_-]+>/gi, " ").split(/\s+/).filter(Boolean).length;

    if (candidateWords <= targetMaxWords) {
      currentText = candidate;
    } else {
      if (currentText) {
        const cleanCurrent = currentText.replace(/<\/?[a-z0-9_-]+>/gi, "").trim();
        const isEnd = /[.!?]$/.test(cleanCurrent);
        chunks.push({ text: currentText, isSentenceEnd: isEnd });
      }

      // If a single standalone sentence is massive (>38 words without a period):
      const sWords = sTrimmed.replace(/<\/?[a-z0-9_-]+>/gi, " ").split(/\s+/).filter(Boolean).length;
      if (sWords > targetMaxWords) {
        // Split on major clause punctuation (, ; : — -) outside tags
        const clauseMatches =
          sTrimmed.match(/(?:<[^>]+>|[^,;:—-])+([,;:—-]+(?=[\s<]|$)|$)/g) || [sTrimmed];
        let subText = "";
        for (const cl of clauseMatches) {
          const clTrim = cl.trim();
          if (!clTrim) continue;
          const subCandidate = subText ? `${subText} ${clTrim}` : clTrim;
          const subWords = subCandidate.replace(/<\/?[a-z0-9_-]+>/gi, " ").split(/\s+/).filter(Boolean).length;
          if (subWords <= targetMaxWords) {
            subText = subCandidate;
          } else {
            if (subText) {
              chunks.push({ text: subText, isSentenceEnd: false });
            }
            subText = clTrim;
          }
        }
        if (subText) {
          currentText = subText;
        } else {
          currentText = "";
        }
      } else {
        currentText = sTrimmed;
      }
    }
  }

  if (currentText.trim()) {
    const cleanCurrent = currentText.replace(/<\/?[a-z0-9_-]+>/gi, "").trim();
    const isEnd = /[.!?]$/.test(cleanCurrent);
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

  // Clean empty wrapper tags like [whisper][/whisper]
  text = text.replace(/\[(whisper|soft|yell|shout|loud|raise|emphasis)\]\s*\[\/\1\]/gi, "");

  // Match either [pause X.Xs] or pointed tone wrapper blocks
  const TOKEN_REGEX = /\[pause\s*([0-9.]+)\s*(?:s|sec|seconds)?\]|\[(whisper|soft|yell|shout|loud|raise|emphasis)\]([\s\S]*?)\[\/\2\]/gi;
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
        let tone: "normal" | "whisper" | "yell" | "raise" = "normal";
        if (toneTag === "whisper" || toneTag === "soft") tone = "whisper";
        else if (toneTag === "yell" || toneTag === "shout" || toneTag === "loud") tone = "yell";
        else if (toneTag === "raise" || toneTag === "emphasis") tone = "raise";
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
   * Ensures the CosyVoice 3 engine is loaded with the configured device (GPU / CPU) and voice profile.
   */
  private async ensureModelLoaded(opts: {
    engine?: "cosyvoice3";
    language?: string;
    lavaSrEnabled?: boolean;
    instruct?: string;
    emotion?: string;
    pace?: string;
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

    const rawEmotion = opts.emotion?.toLowerCase() || "";
    const validEmotions = ["anger", "happy", "neutral", "sad"];
    const emotion = validEmotions.includes(rawEmotion)
      ? rawEmotion
      : undefined;

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

    console.log(
      `[Echo Voice Engine] CosyVoice 3 setup: refWavPath=${refWavPath}, hasCloningModels=${hasCloningModels}, device=${this.inferenceDevice}`,
    );

    const key = [
      "cosyvoice3",
      refWavPath || "native",
      emotion || "none",
      lavaSr ? "lavasr48k" : "native24k",
      this.inferenceDevice,
    ].join("|");

    const cachedModelId = this.loadedModels.get(key);
    if (cachedModelId) {
      return { modelId: cachedModelId, engine: "cosyvoice3" };
    }

    const voiceDesc = refWavPath ? ` voice="${path.basename(refWavPath)}"` : " (native studio voice)";
    const emotionDesc = emotion ? ` emotion="${emotion}"` : "";
    const deviceLabel = this.inferenceDevice === "gpu" ? "GPU (Metal)" : "CPU";
    opts.onLog?.({
      text: `[Echo Voice Engine] Loading CosyVoice 3 Engine (0.5B Q8_0 [FP32 Flow Matching]${lavaSr ? " +LavaSR 48kHz" : ""}${voiceDesc}${emotionDesc} [${deviceLabel}])...`,
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
          }
        : {}),
      ...(lavaSr && lavasrSrc
        ? { lavasrEnhancerModelSrc: lavasrSrc }
        : {}),
      ...(emotion ? { emotion } : {}),
    };

    const modelId = await (qvacSdk as any).loadModel({
      modelSrc: cosyvoiceDescriptor,
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
      const voicePrompt =
        options.voicePrompt ||
        options.prompt ||
        options.description ||
        firstRound.prompt ||
        firstRound.description;

      const rawEmotion = firstRound.emotion?.toLowerCase() || "";
      const validEmotions = [
        "command", "anger", "narration", "conversation", "disgust",
        "fear", "happy", "neutral", "proper noun", "news", "sad", "surprise"
      ];
      const detectedEmotion = validEmotions.includes(rawEmotion)
        ? rawEmotion
        : undefined;

      const firstRoundRefAudio = firstRound.referenceAudioSrc || options.referenceAudioSrc;
      const { engine } = await this.ensureModelLoaded({
        engine: activeEngine,
        language: options.language || "en",
        lavaSrEnabled,
        instruct: voicePrompt || undefined,
        emotion: detectedEmotion,
        pace: firstRound.pace?.toLowerCase(),
        referenceAudioSrc: firstRoundRefAudio,
        taskId,
        onProgress,
        onLog,
      });

      if (isCancelled?.()) return { success: false, error: "Cancelled" };

      const allSamples: number[] = [];
      let sampleRate = lavaSrEnabled ? 48000 : 24000;

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
        const roundRawEmotion = round.emotion?.toLowerCase() || "";
        const roundEmotion = validEmotions.includes(roundRawEmotion) ? roundRawEmotion : detectedEmotion;

        const { modelId: roundModelId } = await this.ensureModelLoaded({
          engine: activeEngine,
          language: options.language || "en",
          lavaSrEnabled,
          instruct: round.prompt || round.description || voicePrompt || undefined,
          emotion: roundEmotion,
          pace: round.pace?.toLowerCase(),
          referenceAudioSrc: roundRefAudio,
          taskId,
          onProgress,
          onLog,
        });

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

        // Parse explicit [pause X.Xs] cues and pointed tone blocks ([whisper], [yell], [raise])
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
            // Process cues & formatting for CosyVoice 3 native instruct tags
            const { cleanedText, detectedCues, tone: segTone } = processConversationalCues(seg.text, seg.tone);
            if (!cleanedText) continue;

            // Split into natural sentence chunks (up to 36 words / ~15s)
            // Keeping complete sentences intact so prosody, melody, and flow are never broken
            const sentenceChunks = splitSpeechIntoSentences(cleanedText, 36);

            for (let cIdx = 0; cIdx < sentenceChunks.length; cIdx++) {
              const chunkObj = sentenceChunks[cIdx];
              const chunkText = chunkObj.text;
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
              // - 0.38s between complete sentences (natural human breath pause)
              // - 0.28s between cue-tagged segments
              if (allSamples.length > 0) {
                const isMidSentence = cIdx > 0 && !sentenceChunks[cIdx - 1].isSentenceEnd;
                const pauseDuration = isMidSentence ? 0.14 : (cIdx > 0 ? 0.38 : 0.28);
                const interPause = generateAcousticRoomPause(pauseDuration, sampleRate);
                crossfadeAppend(allSamples, interPause, sampleRate, 12);
              }
              speechSegCount++;

              const ttsPayload: any = {
                modelId: roundModelId,
                text: chunkText,
                inputType: "text",
                stream: false,
              };

              if (engine === "cosyvoice3") {
                const roundEmotion = (round.emotion?.toLowerCase() || detectedEmotion || "").trim();
                const validCosyEmotions = ["anger", "happy", "neutral", "sad"];

                if (segTone === "whisper" || detectedCues.includes("whisper")) {
                  // Pointed whisper: CosyVoice 3 native soft volume and slow pace
                  ttsPayload.volume = "soft";
                  ttsPayload.pace = "slow";
                } else if (segTone === "yell" || detectedCues.includes("yell")) {
                  // Pointed yell: CosyVoice 3 native loud volume and anger emotion for forceful projection
                  ttsPayload.volume = "loud";
                  ttsPayload.emotion = "anger";
                } else if (segTone === "raise" || detectedCues.includes("raise")) {
                  // Pointed pitch raise: CosyVoice 3 native loud volume with elevated delivery
                  ttsPayload.volume = "loud";
                } else {
                  // Normal segment: map base round emotion
                  let cosyEmotion = validCosyEmotions.includes(roundEmotion) ? roundEmotion : undefined;
                  if ((detectedCues.includes("sigh") || detectedCues.includes("breath")) && !cosyEmotion) {
                    cosyEmotion = "sad";
                  }

                  if (cosyEmotion && cosyEmotion !== "neutral") {
                    ttsPayload.emotion = cosyEmotion;
                  } else {
                    const roundPace = (round.pace?.toLowerCase() || "").trim();
                    const validPaces = ["slow", "moderate", "fast"];
                    if (validPaces.includes(roundPace) && roundPace !== "moderate") {
                      ttsPayload.pace = roundPace;
                    }
                  }
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
