import { DatabaseService } from '../../db/services/db.service'

export interface CustomVoiceRecord {
  id: string
  name: string
  description?: string
  category?: string
  color?: string
  avatarUrl?: string
  initials?: string
  gender?: string
  tags?: string[]
  referenceAudioName?: string
  sampleUrl?: string
  languageCode?: string
  languageName?: string
  createdAt?: Date
  updatedAt?: Date
}

export class VoiceRepositoryService {
  private db: DatabaseService

  constructor(db: DatabaseService) {
    this.db = db
  }

  /**
   * Query all custom cloned voices from SQLite
   */
  public async listCustomVoices(): Promise<CustomVoiceRecord[]> {
    await this.db.init()
    try {
      const records = await this.db.client.customVoice.findMany({
        orderBy: { createdAt: 'desc' },
      })
      return records.map((v) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        category: v.category,
        color: v.color,
        avatarUrl: v.avatarUrl,
        initials: v.initials,
        gender: v.gender,
        tags: v.tags ? JSON.parse(v.tags) : [],
        referenceAudioName: v.referenceAudioName || undefined,
        sampleUrl: v.sampleUrl || undefined,
        languageCode: v.languageCode || undefined,
        languageName: v.languageName || undefined,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }))
    } catch (err) {
      console.error('[VoiceRepositoryService] Failed to query custom voices:', err)
      return []
    }
  }

  /**
   * Save or update a custom voice record in SQLite
   */
  public async saveCustomVoice(voice: CustomVoiceRecord): Promise<{ success: boolean; error?: string }> {
    await this.db.init()
    try {
      await this.db.client.customVoice.upsert({
        where: { id: voice.id },
        update: {
          name: voice.name,
          description: voice.description || '',
          category: voice.category || 'cloned',
          color: voice.color || '#38bdf8',
          avatarUrl: voice.avatarUrl || '/voices/sterling.jpg',
          initials: voice.initials || voice.name.slice(0, 2).toUpperCase(),
          gender: voice.gender || 'Neutral',
          tags: JSON.stringify(voice.tags || []),
          referenceAudioName: voice.referenceAudioName,
          sampleUrl: voice.sampleUrl,
          languageCode: voice.languageCode,
          languageName: voice.languageName,
        },
        create: {
          id: voice.id,
          name: voice.name,
          description: voice.description || '',
          category: voice.category || 'cloned',
          color: voice.color || '#38bdf8',
          avatarUrl: voice.avatarUrl || '/voices/sterling.jpg',
          initials: voice.initials || voice.name.slice(0, 2).toUpperCase(),
          gender: voice.gender || 'Neutral',
          tags: JSON.stringify(voice.tags || []),
          referenceAudioName: voice.referenceAudioName,
          sampleUrl: voice.sampleUrl,
          languageCode: voice.languageCode,
          languageName: voice.languageName,
        },
      })
      return { success: true }
    } catch (err: any) {
      console.error('[VoiceRepositoryService] Failed to save custom voice:', err)
      return { success: false, error: err?.message || String(err) }
    }
  }

  /**
   * Delete a custom voice from SQLite
   */
  public async deleteCustomVoice(id: string): Promise<{ success: boolean; error?: string }> {
    await this.db.init()
    try {
      await this.db.client.customVoice.delete({
        where: { id },
      })
      return { success: true }
    } catch (err: any) {
      console.error('[VoiceRepositoryService] Failed to delete custom voice:', err)
      return { success: false, error: err?.message || String(err) }
    }
  }
}
