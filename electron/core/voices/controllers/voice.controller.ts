import { ipcMain } from 'electron'
import { BaseController } from '../../base.controller'
import { IPC_CHANNELS } from '../../ipc-channels'
import type { VoiceService } from '../services/voice.service'

export class VoiceController extends BaseController {
  constructor(private readonly voiceService: VoiceService) {
    super()
  }

  public init(): void {
    // 1. Scan voice samples packages and read header info.json
    ipcMain.handle(IPC_CHANNELS.VOICES_SCAN, async () => {
      return this.voiceService.scanVoicePackages()
    })

    // Legacy channel alias for backward compatibility
    ipcMain.handle(IPC_CHANNELS.LEGACY_SCAN_VOICE_SAMPLES, async () => {
      return this.voiceService.scanVoicePackages()
    })

    // 2. Load detailed voice list for a package folder
    ipcMain.handle(
      IPC_CHANNELS.VOICES_LOAD,
      async (_: Electron.IpcMainInvokeEvent, { folder, list }: { folder: string; list?: string }) => {
        return this.voiceService.loadVoicesForPackage(folder, list)
      }
    )

    // 3. Save custom cloned/imported voice audio sample to disk
    ipcMain.handle(
      IPC_CHANNELS.VOICES_SAVE_CUSTOM,
      async (_: Electron.IpcMainInvokeEvent, payload: {
        voiceId: string
        name: string
        audioBuffer: Buffer | ArrayBuffer | Uint8Array
        fileName?: string
        avatarBuffer?: Buffer | ArrayBuffer | Uint8Array
        avatarFileName?: string
      }) => {
        return this.voiceService.saveCustomVoice(payload)
      }
    )

    // 4. Delete custom voice files from disk and SQLite
    ipcMain.handle(
      IPC_CHANNELS.VOICES_DELETE_CUSTOM,
      async (_: Electron.IpcMainInvokeEvent, { voiceId }: { voiceId: string }) => {
        return this.voiceService.deleteCustomVoice(voiceId)
      }
    )

    // 5. Query all custom cloned voices from SQLite
    const handleListCustomVoices = async () => {
      try {
        const list = await this.voiceService.listCustomVoices()
        return { success: true, data: list }
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) }
      }
    }
    ipcMain.handle(IPC_CHANNELS.VOICES_LIST_CUSTOM, handleListCustomVoices)
    ipcMain.handle('db:voices:list', handleListCustomVoices)

    // 6. Save/update custom voice metadata in SQLite (`db:voices:save`)
    ipcMain.handle('db:voices:save', async (_: Electron.IpcMainInvokeEvent, voice: any) => {
      try {
        const repo = this.voiceService.getRepository()
        if (!repo) {
          return { success: false, error: 'Voice repository unavailable' }
        }
        return await repo.saveCustomVoice(voice)
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) }
      }
    })

    // 7. Delete custom voice alias (`db:voices:delete`)
    ipcMain.handle('db:voices:delete', async (_: Electron.IpcMainInvokeEvent, { id }: { id: string }) => {
      return this.voiceService.deleteCustomVoice(id)
    })
  }
}
