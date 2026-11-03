import { ipcMain } from 'electron'
import { BaseController } from '../../base.controller'
import { IPC_CHANNELS } from '../../ipc-channels'
import type { ModelsService } from '../services/models.service'
import type { ModelDownloadOptions, VoiceEngineType } from '../interfaces'

export class ModelsController extends BaseController {
  constructor(private readonly modelsService: ModelsService) {
    super()
  }

  public init(): void {
    // 1. Get models status (scoped to requested engine, e.g. cosyvoice3 or parler)
    ipcMain.handle(
      IPC_CHANNELS.MODELS_GET_STATUS,
      async (_event: Electron.IpcMainInvokeEvent, payload?: { engine?: VoiceEngineType }) => {
        try {
          const status = this.modelsService.getStatus(payload?.engine)
          return { success: true, data: status }
        } catch (err) {
          return { success: false, error: String(err) }
        }
      }
    )

    // 2. Download a single model or all required models for an engine
    ipcMain.handle(
      IPC_CHANNELS.MODELS_DOWNLOAD,
      async (event: Electron.IpcMainInvokeEvent, payload: ModelDownloadOptions) => {
        const onProgress = (p: any) => {
          try {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.MODELS_DOWNLOAD_PROGRESS, p)
            }
          } catch (e) {
            console.warn('[ModelsController] Failed to send download progress:', e)
          }
        }

        if (payload?.allRequired) {
          const status = this.modelsService.getStatus(payload?.engine)
          const required = status.models.filter((m) => m.required && !m.downloaded)
          for (const m of required) {
            await this.modelsService.downloadModel(m.id, onProgress)
          }
          return { success: true, data: this.modelsService.getStatus(payload?.engine) }
        }

        if (payload?.modelId) {
          const result = await this.modelsService.downloadModel(payload.modelId, onProgress)
          return { ...result, data: this.modelsService.getStatus(payload?.engine) }
        }

        return { success: false, error: 'No modelId or allRequired flag specified' }
      }
    )

    // 3. Cancel active download
    ipcMain.handle(
      IPC_CHANNELS.MODELS_CANCEL_DOWNLOAD,
      async (_event: Electron.IpcMainInvokeEvent, { modelId }: { modelId: string }) => {
        const cancelled = this.modelsService.cancelDownload(modelId)
        return { success: cancelled, modelId }
      }
    )

    // 4. Query low-level QVAC model cache info
    ipcMain.handle(
      IPC_CHANNELS.MODELS_GET_INFO,
      async (_event: Electron.IpcMainInvokeEvent, { name }: { name: string }) => {
        try {
          const modelInfo = await this.modelsService.getModelInfo(name)
          return { success: true, data: modelInfo }
        } catch (err) {
          return { success: false, error: String(err) }
        }
      }
    )

    // 5. Delete all installed models from disk and reset engine state
    ipcMain.handle(IPC_CHANNELS.MODELS_DELETE_ALL, async () => {
      try {
        await this.modelsService.deleteAllModels()
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    })
  }
}
