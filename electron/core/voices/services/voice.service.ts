import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type {
  VoicePackageInfo,
  VoiceItem,
  ScanVoicePackagesResult,
  LoadVoicesResult,
} from '../interfaces'
import { VoiceRepositoryService, CustomVoiceRecord } from './voice-repository.service'

export class VoiceService {
  private repository?: VoiceRepositoryService

  constructor(repository?: VoiceRepositoryService) {
    this.repository = repository
  }

  public getRepository(): VoiceRepositoryService | undefined {
    return this.repository
  }

  public async listCustomVoices(): Promise<CustomVoiceRecord[]> {
    if (this.repository) {
      return this.repository.listCustomVoices()
    }
    return []
  }
  /**
   * Resolve root samples directory across dev server and production builds
   */
  public getSamplesDirectory(): string | null {
    const publicDir = process.env.VITE_PUBLIC || path.join(process.cwd(), 'public')
    const candidates = [
      path.join(publicDir, 'voices', 'samples'),
      path.join(process.cwd(), 'public', 'voices', 'samples'),
      path.join(app.getAppPath(), 'public', 'voices', 'samples'),
      path.join(app.getAppPath(), 'dist', 'voices', 'samples'),
    ]

    for (const dir of candidates) {
      if (fs.existsSync(dir)) {
        return dir
      }
    }
    return null
  }

  /**
   * Scan voices/samples directory, detecting all self-contained language folders
   * and reading their header file info.json
   */
  public scanVoicePackages(): ScanVoicePackagesResult {
    try {
      const samplesDir = this.getSamplesDirectory()
      if (!samplesDir) {
        console.warn('[VoiceService] Samples directory not found')
        return { success: false, packages: [], error: 'Samples folder not found' }
      }

      const entries = fs.readdirSync(samplesDir, { withFileTypes: true })
      const packages: VoicePackageInfo[] = []

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const folderPath = path.join(samplesDir, entry.name)
        const infoJsonPath = path.join(folderPath, 'info.json')
        const jsonInfoPath = path.join(folderPath, 'json.info')

        const targetInfoPath = fs.existsSync(infoJsonPath)
          ? infoJsonPath
          : fs.existsSync(jsonInfoPath)
          ? jsonInfoPath
          : null

        if (targetInfoPath) {
          try {
            const raw = fs.readFileSync(targetInfoPath, 'utf-8')
            const header = JSON.parse(raw)
            const relativeList =
              header.list ||
              header.location ||
              (fs.existsSync(path.join(folderPath, 'json', 'voices.json'))
                ? 'json/voices.json'
                : 'voices.json')

            packages.push({
              folder: entry.name,
              language: header.language || entry.name,
              name: header.name || header.language || entry.name,
              flag: header.flag || '🌐',
              code: header.code || entry.name,
              nativeName: header.nativeName || header.name || header.language,
              list: relativeList,
              location: relativeList,
              listUrl: `/voices/samples/${entry.name}/${relativeList.replace(/^\//, '')}`,
              count: header.count || 0,
            })
          } catch (err) {
            console.warn(`[VoiceService] Failed to parse info.json in ${folderPath}:`, err)
          }
        }
      }

      return { success: true, packages }
    } catch (err) {
      console.error('[VoiceService] Failed to scan voice samples:', err)
      return { success: false, packages: [], error: String(err) }
    }
  }

  /**
   * Load voices directly from disk for a given language folder
   */
  public loadVoicesForPackage(
    folder: string,
    listRelativePath = 'json/voices.json'
  ): LoadVoicesResult {
    try {
      const samplesDir = this.getSamplesDirectory()
      if (!samplesDir) {
        return { success: false, voices: [], error: 'Samples directory not found' }
      }

      const cleanList = listRelativePath.replace(/^\//, '')
      const possibleJsonPaths = [
        path.join(samplesDir, folder, cleanList),
        path.join(samplesDir, folder, 'json', 'voices.json'),
        path.join(samplesDir, folder, 'voices.json'),
      ]

      const jsonPath = possibleJsonPaths.find((p) => fs.existsSync(p))
      if (!jsonPath) {
        return { success: false, voices: [], error: `Voice list not found for folder ${folder}` }
      }

      const content = fs.readFileSync(jsonPath, 'utf-8')
      const parsed = JSON.parse(content)
      const voices: VoiceItem[] = Array.isArray(parsed) ? parsed : parsed.voices || []

      return { success: true, voices }
    } catch (err) {
      console.error(`[VoiceService] Failed to load voices for ${folder}:`, err)
      return { success: false, voices: [], error: String(err) }
    }
  }

  /**
   * Resolve or create the custom voices directory inside public/voices/custom
   */
  public getCustomVoicesDirectory(): string {
    const publicDir = process.env.VITE_PUBLIC || path.join(process.cwd(), 'public')
    const customDir = path.join(publicDir, 'voices', 'custom')
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true })
    }
    return customDir
  }

  /**
   * Saves an imported or microphone-recorded voice audio sample directly to disk
   * and converts it to a standard 24kHz mono WAV for CosyVoice 3 reference conditioning.
   */
  public async saveCustomVoice(payload: {
    voiceId: string
    name: string
    audioBuffer: Buffer | ArrayBuffer | Uint8Array
    fileName?: string
    avatarBuffer?: Buffer | ArrayBuffer | Uint8Array
    avatarFileName?: string
  }): Promise<{
    success: boolean
    filePath?: string
    sampleUrl?: string
    avatarUrl?: string
    error?: string
  }> {
    try {
      const customDir = this.getCustomVoicesDirectory()
      const rawBase = (payload.fileName || 'sample.wav').replace(/[^a-zA-Z0-9._-]/g, '_')
      const origExt = path.extname(rawBase).toLowerCase() || '.wav'
      const timestamp = Date.now()
      const origName = `voice_${payload.voiceId}_${timestamp}${origExt}`
      const origPath = path.join(customDir, origName)

      // Write uploaded/recorded audio buffer
      const buf = Buffer.isBuffer(payload.audioBuffer)
        ? payload.audioBuffer
        : Buffer.from(payload.audioBuffer as ArrayBuffer)
      fs.writeFileSync(origPath, buf)

      let finalPath = origPath
      let finalSampleUrl = `/voices/custom/${origName}`

      // Convert to 24kHz 16-bit mono WAV for dr_wav/CosyVoice 3 if not already WAV
      if (origExt !== '.wav') {
        const wavName = `voice_${payload.voiceId}_${timestamp}.wav`
        const wavPath = path.join(customDir, wavName)
        try {
          const { execFileSync } = await import('node:child_process')
          execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', '-c', '1', origPath, wavPath])
          if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 100) {
            finalPath = wavPath
            finalSampleUrl = `/voices/custom/${wavName}`
          }
        } catch (err) {
          console.warn('[VoiceService] Audio conversion fallback, using original file:', err)
        }
      }

      // Handle optional custom avatar
      let finalAvatarUrl: string | undefined = undefined
      if (payload.avatarBuffer) {
        const avBuf = Buffer.isBuffer(payload.avatarBuffer)
          ? payload.avatarBuffer
          : Buffer.from(payload.avatarBuffer as ArrayBuffer)
        if (avBuf.byteLength > 0) {
          const avExt = path.extname(payload.avatarFileName || '.jpg').toLowerCase() || '.jpg'
          const avName = `avatar_${payload.voiceId}_${timestamp}${avExt}`
          const avPath = path.join(customDir, avName)
          fs.writeFileSync(avPath, avBuf)
          finalAvatarUrl = `/voices/custom/${avName}`
        }
      }

      if (this.repository) {
        await this.repository.saveCustomVoice({
          id: payload.voiceId,
          name: payload.name,
          category: 'cloned',
          avatarUrl: finalAvatarUrl || '/voices/sterling.jpg',
          sampleUrl: finalSampleUrl,
          referenceAudioName: path.basename(finalPath),
        })
      }

      return {
        success: true,
        filePath: finalPath,
        sampleUrl: finalSampleUrl,
        avatarUrl: finalAvatarUrl,
      }
    } catch (err) {
      console.error('[VoiceService] Failed to save custom voice:', err)
      return { success: false, error: String(err) }
    }
  }

  /**
   * Delete a custom voice from disk and SQLite
   */
  public async deleteCustomVoice(voiceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.repository) {
        await this.repository.deleteCustomVoice(voiceId)
      }

      const customDir = this.getCustomVoicesDirectory()
      if (fs.existsSync(customDir)) {
        const files = fs.readdirSync(customDir)
        for (const file of files) {
          if (file.includes(`_${voiceId}_`)) {
            try {
              fs.unlinkSync(path.join(customDir, file))
            } catch {}
          }
        }
      }
      return { success: true }
    } catch (err) {
      console.error('[VoiceService] Failed to delete custom voice files:', err)
      return { success: false, error: String(err) }
    }
  }
}
