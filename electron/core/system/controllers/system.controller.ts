import { ipcMain } from 'electron'
import { BaseController } from '../../base.controller'
import { IPC_CHANNELS } from '../../ipc-channels'
import type { SystemService } from '../services/system.service'

export class SystemController extends BaseController {
  constructor(private readonly systemService: SystemService) {
    super()
  }

  public init(): void {
    // 1. Get real-time system hardware telemetry (CPU, RAM, GPU)
    ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_METRICS, async () => {
      return this.systemService.getMetrics()
    })

    // Legacy channel alias for backward compatibility
    ipcMain.handle(IPC_CHANNELS.LEGACY_GET_SYSTEM_METRICS, async () => {
      return this.systemService.getMetrics()
    })

    // 2. Reveal exports directory in OS shell
    ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_EXPORTS, async () => {
      return this.systemService.openExportsFolder()
    })

    // Legacy channel alias for backward compatibility
    ipcMain.handle(IPC_CHANNELS.LEGACY_OPEN_EXPORTS_FOLDER, async () => {
      return this.systemService.openExportsFolder()
    })
  }
}
