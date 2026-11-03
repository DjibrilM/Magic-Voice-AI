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
    if (!this.repository) {
      return []
    }
    const records = await this.repository.listCustomVoices()
    return records.map((record) => {
      const resolvedSample = this.resolveVoiceAssetDiskPath(
        record.sampleUrl || (record.referenceAudioName ? `/voices/custom/${record.referenceAudioName}` : undefined)
      )
      const resolvedAvatar = this.resolveVoiceAssetDiskPath(
        record.avatarUrl || '/voices/sterling.jpg'
      )
      return {
        ...record,
        sampleUrl: resolvedSample ? this.toEchoMediaUrl(resolvedSample) : record.sampleUrl,
        avatarUrl: resolvedAvatar ? this.toEchoMediaUrl(resolvedAvatar) : record.avatarUrl,
      }
    })
  }

  public toEchoMediaUrl(diskPath: string): string {
    const normalized = diskPath.replace(/\\/g, '/')
    const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
    return `echo-media://${encodeURI(withLeadingSlash)}`
  }

  /**
   * Return all existing candidate `voices` root directories across dev and packaged builds
   */
  public getVoicesRootDirectories(): string[] {
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    const publicDir = process.env.VITE_PUBLIC || path.join(process.cwd(), 'public')
    const appPath = app ? app.getAppPath() : process.cwd()
    const userDataVoices = app ? path.join(app.getPath('userData'), 'voices') : ''

    const candidates = [
      ...(resourcesPath
        ? [
            path.join(resourcesPath, 'app.asar.unpacked', 'voices'),
            path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'voices'),
            path.join(resourcesPath, 'voices'),
          ]
        : []),
      ...(userDataVoices ? [userDataVoices] : []),
      path.join(publicDir, 'voices'),
      path.join(appPath, 'dist', 'voices'),
      path.join(appPath, 'public', 'voices'),
      path.join(process.cwd(), 'public', 'voices'),
    ]

    const unique = Array.from(new Set(candidates))
    return unique.filter((dir) => {
      try {
        return fs.existsSync(dir)
      } catch {
        return false
      }
    })
  }

  /**
   * Resolve a `/voices/...` URL, `echo-media://...` URL, or relative filename to an actual disk file path
   */
  public resolveVoiceAssetDiskPath(rawPath?: string, sampleFolder?: string): string | null {
    if (!rawPath || typeof rawPath !== 'string') return null

    if (rawPath.startsWith('echo-media://')) {
      const stripped = decodeURIComponent(rawPath.replace(/^echo-media:\/\//, ''))
      const normalized = stripped.startsWith('/') ? stripped : `/${stripped}`
      if (fs.existsSync(normalized)) return normalized
    }

    if (path.isAbsolute(rawPath) && fs.existsSync(rawPath)) {
      return rawPath
    }

    const cleaned = rawPath
      .replace(/^\.?\//, '')
      .replace(/^voices\//, '')

    const customDir = this.getCustomVoicesDirectory()
    const voicesRoots = this.getVoicesRootDirectories()

    const candidates: string[] = []

    if (cleaned.startsWith('custom/')) {
      const sub = cleaned.replace(/^custom\//, '')
      candidates.push(path.join(customDir, sub))
    }

    for (const root of voicesRoots) {
      candidates.push(path.join(root, cleaned))
      if (sampleFolder && !cleaned.startsWith('samples/')) {
        candidates.push(path.join(root, 'samples', sampleFolder, cleaned))
      }
    }

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate
        }
      } catch {
        // ignore
      }
    }

    return null
  }

  /**
   * Resolve root samples directory across dev server and production builds
   */
  public getSamplesDirectory(): string | null {
    const roots = this.getVoicesRootDirectories()
    for (const root of roots) {
      const samplesDir = path.join(root, 'samples')
      try {
        if (fs.existsSync(samplesDir) && fs.statSync(samplesDir).isDirectory()) {
          return samplesDir
        }
      } catch {
        // ignore
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
      const rawVoices: VoiceItem[] = Array.isArray(parsed) ? parsed : parsed.voices || []

      const voices: VoiceItem[] = rawVoices.map((item) => {
        const rawAudio = item.audio || item.sampleUrl || ''
        const rawImage = item.image || item.avatarUrl || '/voices/sterling.jpg'

        const diskAudio = this.resolveVoiceAssetDiskPath(rawAudio, folder)
        const diskImage = this.resolveVoiceAssetDiskPath(rawImage, folder)

        const sampleUrl = diskAudio
          ? this.toEchoMediaUrl(diskAudio)
          : rawAudio.startsWith('/')
            ? rawAudio
            : `/voices/samples/${folder}/${rawAudio}`

        const avatarUrl = diskImage
          ? this.toEchoMediaUrl(diskImage)
          : rawImage.startsWith('/')
            ? rawImage
            : `/voices/${rawImage}`

        return {
          ...item,
          audio: sampleUrl,
          sampleUrl,
          image: avatarUrl,
          avatarUrl,
        }
      })

      return { success: true, voices }
    } catch (err) {
      console.error(`[VoiceService] Failed to load voices for ${folder}:`, err)
      return { success: false, voices: [], error: String(err) }
    }
  }

  /**
   * Resolve or create the writable custom voices directory
   */
  public getCustomVoicesDirectory(): string {
    const isPackaged = app ? app.isPackaged : false
    const customDir = isPackaged
      ? path.join(app.getPath('userData'), 'voices', 'custom')
      : path.join(process.cwd(), 'public', 'voices', 'custom')
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

      const resolvedSampleUrl = this.toEchoMediaUrl(finalPath)
      const resolvedAvatarDisk = finalAvatarUrl
        ? this.resolveVoiceAssetDiskPath(finalAvatarUrl)
        : this.resolveVoiceAssetDiskPath('/voices/sterling.jpg')
      const resolvedAvatarUrl = resolvedAvatarDisk
        ? this.toEchoMediaUrl(resolvedAvatarDisk)
        : finalAvatarUrl || '/voices/sterling.jpg'

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
        sampleUrl: resolvedSampleUrl,
        avatarUrl: resolvedAvatarUrl,
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
