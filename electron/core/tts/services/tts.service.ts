import type {
  TtsGenerateOptions,
  TtsProgressCallback,
  TtsLogCallback,
  TtsGenerateResult,
} from '../interfaces'
import type {
  VoiceModelStatusResult,
  ModelDownloadProgressPayload,
} from '../../models/interfaces'
import { VoiceEngineService } from './voice-engine.service'
import { ModelsService } from '../../models/services/models.service'
import { ConversationRepositoryService, SaveConversationInput } from './conversation-repository.service'

export class TtsService {
  private activeTasks = new Set<string>()
  private voiceEngine: VoiceEngineService
  private modelsService: ModelsService
  private conversationRepo?: ConversationRepositoryService

  constructor(modelsService?: ModelsService, conversationRepo?: ConversationRepositoryService) {
    this.modelsService = modelsService || new ModelsService()
    this.voiceEngine = new VoiceEngineService(this.modelsService)
    this.conversationRepo = conversationRepo
  }

  /** Access conversation persistence repository */
  public getConversationRepository(): ConversationRepositoryService | undefined {
    return this.conversationRepo
  }

  /** Query all persisted conversations from SQLite */
  public async listConversations(): Promise<any[]> {
    if (this.conversationRepo) {
      return this.conversationRepo.listConversations()
    }
    return []
  }

  /** Save conversation and dialogue rounds to SQLite */
  public async saveConversation(data: SaveConversationInput): Promise<{ success: boolean; error?: string }> {
    if (this.conversationRepo) {
      return this.conversationRepo.saveConversation(data)
    }
    return { success: false, error: 'Conversation repository unavailable' }
  }

  /** Delete conversation from SQLite */
  public async deleteConversation(id: string): Promise<{ success: boolean; error?: string }> {
    if (this.conversationRepo) {
      return this.conversationRepo.deleteConversation(id)
    }
    return { success: false, error: 'Conversation repository unavailable' }
  }

  /** Clear all conversations from SQLite */
  public async clearConversations(): Promise<{ success: boolean; error?: string }> {
    if (this.conversationRepo) {
      return this.conversationRepo.clearConversations()
    }
    return { success: false, error: 'Conversation repository unavailable' }
  }

  /** Access the underlying voice engine neural service */
  public getVoiceEngine(): VoiceEngineService {
    return this.voiceEngine
  }

  /** Access the underlying models service */
  public getModelsService(): ModelsService {
    return this.modelsService
  }

  /** Get voice engine models download status */
  public getModelStatus(selectedEngine?: 'cosyvoice3' | 'chatterbox'): VoiceModelStatusResult {
    return this.modelsService.getStatus(selectedEngine)
  }

  /** Download a specific model */
  public async downloadModel(
    modelId: string,
    onProgress?: (p: ModelDownloadProgressPayload) => void
  ): Promise<{ success: boolean; modelId: string; error?: string }> {
    return this.modelsService.downloadModel(modelId, onProgress)
  }

  /** Cancel an in-flight model download */
  public cancelModelDownload(modelId: string): boolean {
    return this.modelsService.cancelDownload(modelId)
  }

  /** Delete all installed models from disk and reset engine state */
  public async deleteAllModels(): Promise<boolean> {
    return this.voiceEngine.deleteAllModels()
  }

  /** Cancel an active generation task + underlying QVAC request */
  public cancelGeneration(taskId: string): boolean {
    if (this.activeTasks.has(taskId)) {
      this.activeTasks.delete(taskId)
      try {
        ;(this.voiceEngine as any).cancelSynthesis?.(taskId)
      } catch {}
      return true
    }
    return false
  }

  /** Check if a task was cancelled */
  public isCancelled(taskId: string): boolean {
    return !this.activeTasks.has(taskId)
  }

  /** High-fidelity speech synthesis pipeline using Echo Voice Engine prompt-driven voice design */
  public async generateSpeech(
    options: TtsGenerateOptions,
    onProgress?: TtsProgressCallback,
    onLog?: TtsLogCallback
  ): Promise<TtsGenerateResult> {
    const { taskId } = options
    this.activeTasks.add(taskId)

    try {
      return await this.voiceEngine.synthesize(
        options,
        onProgress,
        onLog,
        () => this.isCancelled(taskId)
      )
    } finally {
      this.activeTasks.delete(taskId)
    }
  }
}
