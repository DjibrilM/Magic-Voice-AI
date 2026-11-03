import { ipcMain } from 'electron'
import { BaseController } from '../../base.controller'
import { IPC_CHANNELS } from '../../ipc-channels'
import type { ActivityRepositoryService, SaveActivityInput } from '../services/activity-repository.service'

export class ActivityController extends BaseController {
  constructor(private readonly activityRepo: ActivityRepositoryService) {
    super()
  }

  public init(): void {
    // 1. List all activities
    ipcMain.handle(IPC_CHANNELS.ACTIVITY_LIST, async () => {
      try {
        const list = await this.activityRepo.listActivities()
        return { success: true, data: list }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    })

    // 2. Get activity by ID
    ipcMain.handle(IPC_CHANNELS.ACTIVITY_GET, async (_event, payload: { id: string } | string) => {
      try {
        const id = typeof payload === 'string' ? payload : payload.id
        const item = await this.activityRepo.getActivityById(id)
        return { success: true, data: item }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    })

    // 3. Get activity by origin ID
    ipcMain.handle(
      IPC_CHANNELS.ACTIVITY_GET_BY_ORIGIN,
      async (_event, payload: { originId: string } | string) => {
        try {
          const originId = typeof payload === 'string' ? payload : payload.originId
          const item = await this.activityRepo.getActivityByOrigin(originId)
          return { success: true, data: item }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          return { success: false, error: message }
        }
      }
    )

    // 4. Save or update an activity
    ipcMain.handle(IPC_CHANNELS.ACTIVITY_SAVE, async (_event, data: SaveActivityInput) => {
      try {
        const res = await this.activityRepo.saveActivity(data)
        return res
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    })

    // 5. Delete an activity
    ipcMain.handle(IPC_CHANNELS.ACTIVITY_DELETE, async (_event, payload: { id: string } | string) => {
      try {
        const id = typeof payload === 'string' ? payload : payload.id
        const res = await this.activityRepo.deleteActivity(id)
        return res
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    })
  }
}
