/**
 * Audio synthesis & WAV encoding utilities for Wavesurfer and audio playback.
 */

/**
 * Convert an AudioBuffer to a standard 16-bit PCM WAV Blob.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  const channelData: Float32Array[] = []
  for (let i = 0; i < numChannels; i++) {
    channelData.push(buffer.getChannelData(i))
  }

  const length = buffer.length * numChannels * 2
  const arrayBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF Chunk
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeString(8, 'WAVE')

  // fmt Subchunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, bitDepth, true)

  // data Subchunk
  writeString(36, 'data')
  view.setUint32(40, length, true)

  // 16-bit PCM samples
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}


/**
 * NOTE: Synthetic oscillator-based speech generation has been removed.
 *
 * Previously this file contained createSyntheticSpeechWavUrl() and
 * createSyntheticWavUrlSync(), which used Web Audio API oscillators
 * (sawtooth/triangle waves) to produce buzzy tone noise — not real speech.
 *
 * The only supported audio generation path is the QVAC / CosyVoice 3 neural
 * TTS pipeline running in the Electron main process
 * (electron/core/tts/services/voice-engine.service.ts). It produces
 * 24 kHz native or 48 kHz (LavaSR-enhanced) studio-grade audio and requires
 * the required models to be downloaded first (see InstallRequiredModelsView).
 *
 * Do not re-add oscillator-based "speech" synthesis here — it generates
 * noise, not high-fidelity audio.
 */


/**
 * Merges multiple audio blobs/URLs sequentially with natural conversational pause gaps.
 * Uses Web Audio API AudioContext to decode PCM data, stitch channels, and re-encode to a 16-bit WAV.
 *
 * This enables the multi-round audio merging pipeline, ensuring individual speaker rounds
 * can be as long as needed (up to 4,096 chars per turn) without hitting single-take token limits
 * or experiencing voice drift, and then combined into a single unified dialogue audio file.
 *
 * @param audioSources Array of audio Blobs or URLs for each speaker round
 * @param pauseSec Duration of natural silence between speaker rounds in seconds (default: 0.45s)
 * @returns Object with the merged Blob, playable Object URL, and total duration in seconds
 */
export async function mergeAudioBuffersOrBlobs(
  audioSources: (Blob | string)[],
  pauseSec = 0.45
): Promise<{ url: string; duration: number; blob: Blob }> {
  try {
    if (audioSources.length === 0) {
      const emptyBlob = new Blob([], { type: 'audio/wav' })
      return { url: '', duration: 0, blob: emptyBlob }
    }

    if (audioSources.length === 1) {
      const src = audioSources[0]
      if (src instanceof Blob) {
        return { url: URL.createObjectURL(src), duration: 0, blob: src }
      }
      return { url: src, duration: 0, blob: new Blob() }
    }

    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const audioCtx = new AudioCtxClass()

    // 1. Fetch & decode all round audio buffers
    const decodedBuffers: AudioBuffer[] = await Promise.all(
      audioSources.map(async (item) => {
        const arrayBuffer =
          typeof item === 'string'
            ? await fetch(item).then((r) => r.arrayBuffer())
            : await item.arrayBuffer()
        return audioCtx.decodeAudioData(arrayBuffer)
      })
    )

    const sampleRate = decodedBuffers[0].sampleRate
    const numChannels = Math.max(...decodedBuffers.map((b) => b.numberOfChannels))
    const pauseSamples = Math.round(sampleRate * pauseSec)

    // 2. Compute total sample length across all rounds + silence pauses
    const totalSamples = decodedBuffers.reduce(
      (acc, buf, idx) => acc + buf.length + (idx < decodedBuffers.length - 1 ? pauseSamples : 0),
      0
    )

    // 3. Create unified AudioBuffer
    const mergedBuffer = audioCtx.createBuffer(numChannels, totalSamples, sampleRate)
    let offset = 0

    // 4. Sequentially copy PCM data across channels
    for (const buf of decodedBuffers) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sourceData = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1))
        mergedBuffer.getChannelData(ch).set(sourceData, offset)
      }
      offset += buf.length + pauseSamples
    }

    // 5. Convert combined buffer into a standard 16-bit PCM WAV Blob
    const mergedBlob = audioBufferToWavBlob(mergedBuffer)
    const mergedUrl = URL.createObjectURL(mergedBlob)

    return {
      url: mergedUrl,
      duration: Math.round(mergedBuffer.duration),
      blob: mergedBlob,
    }
  } catch (err) {
    console.error('Error merging speaker round audios:', err)
    const emptyBlob = new Blob([], { type: 'audio/wav' })
    return { url: '', duration: 0, blob: emptyBlob }
  }
}
