import { ipcMain } from 'electron'
import { BaseController } from '../../base.controller'
import { IPC_CHANNELS } from '../../ipc-channels'
import type { TtsService } from '../services/tts.service'
import type { TtsGenerateOptions } from '../interfaces'

export class TtsController extends BaseController {
  constructor(private readonly ttsService: TtsService) {
    super()
  }

  public init(): void {
    // 1. Voice generation handler with live real-time IPC progress and terminal logs
    ipcMain.handle(
      IPC_CHANNELS.TTS_GENERATE,
      async (event: Electron.IpcMainInvokeEvent, options: TtsGenerateOptions) => {
        // Guard: refuse synthesis if required models for the requested engine are not downloaded
        const targetEngine = options.engine || 'cosyvoice3'
        const status = this.ttsService.getModelStatus(targetEngine)
        const requiredNotReady = status.models.filter((m) => m.required && !m.downloaded)
        if (requiredNotReady.length > 0) {
          return {
            success: false,
            error: `Required voice engine models not downloaded: ${requiredNotReady.map((m) => m.name).join(', ')}`,
          }
        }

        const sendProgress = (data: {
          taskId: string
          progress: number
          message: string
          phase: string
        }) => {
          try {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.TTS_PROGRESS, data)
            }
          } catch (err) {
            console.warn('[TtsController] Failed to send progress event:', err)
          }
        }

        const sendLog = (log: { text: string; stream: 'stdout' | 'stderr' | 'system' }) => {
          try {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.TERMINAL_LOG, {
                projectId: 'echo-ai',
                text: log.text,
                stream: log.stream,
                timestamp: new Date().toISOString(),
              })
            }
          } catch (err) {
            console.warn('[TtsController] Failed to send log event:', err)
          }
        }

        const result = await this.ttsService.generateSpeech(options, sendProgress, sendLog)

        if (result.success && result.data) {
          try {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.TTS_COMPLETE, {
                taskId: options.taskId,
                generation: result.data,
              })
            }
          } catch (err) {
            console.warn('[TtsController] Failed to send complete event:', err)
          }
        } else if (!result.success) {
          try {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.TTS_ERROR, {
                taskId: options.taskId,
                error: result.error || 'Generation failed',
              })
            }
          } catch (err) {
            console.warn('[TtsController] Failed to send error event:', err)
          }
        }

        return result
      }
    )

    // 2. Cancel ongoing generation task
    ipcMain.handle(
      IPC_CHANNELS.TTS_CANCEL,
      async (_: Electron.IpcMainInvokeEvent, { taskId }: { taskId: string }) => {
        const cancelled = this.ttsService.cancelGeneration(taskId)
        return { success: cancelled, taskId }
      }
    )

    // 3. Query all saved conversations from SQLite
    ipcMain.handle(IPC_CHANNELS.TTS_HISTORY_LIST, async () => {
      try {
        const list = await this.ttsService.listConversations()
        return { success: true, data: list }
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) }
      }
    })

    // 4. Save conversation and dialogue rounds to SQLite
    ipcMain.handle(IPC_CHANNELS.TTS_HISTORY_SAVE, async (_event, data: any) => {
      try {
        const res = await this.ttsService.saveConversation(data)
        return res
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) }
      }
    })

    // 5. Delete a conversation from SQLite
    ipcMain.handle(IPC_CHANNELS.TTS_HISTORY_DELETE, async (_event, payload: { id: string } | string) => {
      try {
        const id = typeof payload === 'string' ? payload : payload.id
        const res = await this.ttsService.deleteConversation(id)
        return res
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) }
      }
    })

    // 6. Clear all conversations from SQLite
    ipcMain.handle(IPC_CHANNELS.TTS_HISTORY_CLEAR, async () => {
      try {
        const res = await this.ttsService.clearConversations()
        return res
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) }
      }
    })
  }
}
