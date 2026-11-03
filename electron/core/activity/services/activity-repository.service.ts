import { DatabaseService } from '../../db/services/db.service'
type MusicService = any;

export interface SaveActivityInput {
  id: string
  type: string
  title: string
  description?: string
  category?: string
  subCategory?: string
  originId?: string
  originType?: string
  conversationId?: string
  metadata?: Record<string, unknown> | string
}

interface RawSpeechRound {
  id: string
  roundOrder: number
  voiceId: string
  text: string
  speed: number
  emotion?: string | null
  pace?: string | null
  prompt?: string | null
  description?: string | null
  referenceAudioSrc?: string | null
  speakerName?: string | null
  speakerColor?: string | null
}

interface RawConversation {
  id: string
  text: string
  previewSnippet?: string | null
  voiceName: string
  voiceColor: string
  voiceAvatarUrl?: string | null
  model: string
  engine: string
  duration: string
  durationSec?: number | null
  emotion?: string | null
  audioUrl?: string | null
  waveform?: string | null
  speakerCount: number
  rounds?: RawSpeechRound[]
}

interface RawActivityRecord {
  id: string
  type: string
  title: string
  description?: string | null
  category?: string | null
  subCategory?: string | null
  originId?: string | null
  originType?: string | null
  conversationId?: string | null
  metadata?: string | null
  createdAt: Date | string
  updatedAt: Date | string
  conversation?: RawConversation | null
}

export class ActivityRepositoryService {
  private db: DatabaseService
  private musicService?: MusicService

  constructor(db: DatabaseService, musicService?: MusicService) {
    this.db = db
    this.musicService = musicService
  }

  /**
   * Resolve origin data (TTS, Music, Story) based on activity record and relations
   */
  private formatActivityRecord(a: RawActivityRecord): Record<string, unknown> {
    let parsedMetadata: Record<string, unknown> | undefined = undefined
    if (a.metadata) {
      try {
        parsedMetadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata
        if (parsedMetadata && typeof parsedMetadata === 'object') {
          const rawUrl = parsedMetadata.audioUrl as string | undefined
          const wavPath = parsedMetadata.wavFilePath as string | undefined
          if (wavPath) {
            parsedMetadata.audioUrl = `echo-media://${wavPath}`
          } else if (rawUrl && rawUrl.startsWith('data:') && rawUrl.length > 50000) {
            parsedMetadata.audioUrl = ''
          }
        }
      } catch {
        parsedMetadata = undefined
      }
    }

    // 1. Resolve TTS origin data if conversation relation is present or type is 'tts'
    const ttsData = a.conversation
      ? {
          id: a.conversation.id,
          text: a.conversation.text,
          previewSnippet: a.conversation.previewSnippet || a.conversation.text,
          voiceName: a.conversation.voiceName,
          voiceColor: a.conversation.voiceColor,
          voiceAvatarUrl: a.conversation.voiceAvatarUrl,
          model: a.conversation.model,
          engine: a.conversation.engine,
          duration: a.conversation.duration,
          durationSec: a.conversation.durationSec,
          emotion: a.conversation.emotion,
          audioUrl: a.conversation.audioUrl,
          waveform: a.conversation.waveform ? JSON.parse(a.conversation.waveform) : [],
          speakerCount: a.conversation.speakerCount,
          rounds: Array.isArray(a.conversation.rounds)
            ? a.conversation.rounds.map((r: RawSpeechRound) => ({
                id: r.id,
                roundOrder: r.roundOrder,
                voiceId: r.voiceId,
                text: r.text,
                speed: r.speed,
                emotion: r.emotion,
                pace: r.pace,
                prompt: r.prompt,
                description: r.description,
                referenceAudioSrc: r.referenceAudioSrc,
                speakerName: r.speakerName,
                speakerColor: r.speakerColor,
              }))
            : [],
        }
      : a.type === 'tts' && parsedMetadata
      ? {
          id: a.originId || a.id.replace(/^act-/, ''),
          text: a.description || (parsedMetadata.text as string) || a.title,
          previewSnippet: (parsedMetadata.previewSnippet as string) || a.description || a.title,
          voiceName: (parsedMetadata.voiceName as string) || a.subCategory || 'Speech Synthesis',
          voiceColor: (parsedMetadata.voiceColor as string) || '#38bdf8',
          voiceAvatarUrl: (parsedMetadata.voiceAvatarUrl as string) || '/voices/sterling.jpg',
          model: (parsedMetadata.model as string) || 'cosyvoice-v1',
          engine: (parsedMetadata.engine as string) || 'cosyvoice3',
          duration: (parsedMetadata.duration as string) || 'Audio',
          durationSec: (parsedMetadata.durationSec as number) || 0,
          emotion: (parsedMetadata.emotion as string) || undefined,
          audioUrl: (parsedMetadata.audioUrl as string) || undefined,
          waveform: Array.isArray(parsedMetadata.waveform) ? (parsedMetadata.waveform as number[]) : [],
          speakerCount: (parsedMetadata.speakerCount as number) || 1,
          rounds: Array.isArray(parsedMetadata.rounds) ? (parsedMetadata.rounds as unknown[]) : [],
        }
      : undefined

    // 2. Resolve Music origin data if type is 'music'
    let musicData: Record<string, unknown> | undefined = undefined
    if (a.type === 'music') {
      const musicId = a.originId || a.id.replace(/^act-music-/, '').replace(/^act-/, '')
      const cached = this.musicService?.getHistoryItem(musicId)
      const wavPath = cached?.wavFilePath || (parsedMetadata?.wavFilePath as string)
      let resolvedAudioUrl: string | undefined = wavPath
        ? `echo-media://${wavPath}`
        : cached?.audioUrl || (parsedMetadata?.audioUrl as string)
      if (resolvedAudioUrl && resolvedAudioUrl.startsWith('data:') && resolvedAudioUrl.length > 50000) {
        resolvedAudioUrl = undefined
      }

      musicData = {
        id: musicId,
        taskId: cached?.taskId || (parsedMetadata?.taskId as string) || undefined,
        title: a.title,
        caption: cached?.caption || (parsedMetadata?.caption as string) || a.title,
        lyrics: cached?.lyrics || (parsedMetadata?.lyrics as string) || undefined,
        audioUrl: resolvedAudioUrl,
        wavFilePath: wavPath || undefined,
        duration:
          (parsedMetadata?.duration as string) ||
          (cached?.durationMs ? `${Math.round(cached.durationMs / 1000)}s` : 'Audio'),
        durationMs: cached?.durationMs || (parsedMetadata?.durationMs as number) || undefined,
        waveform: cached?.waveform || (parsedMetadata?.waveform as number[]) || [],
        bpm: cached?.bpm || (parsedMetadata?.bpm as number) || undefined,
        keyscale: cached?.keyscale || (parsedMetadata?.keyscale as string) || undefined,
        timesignature: cached?.timesignature || (parsedMetadata?.timesignature as string) || undefined,
        vocalLanguage: cached?.vocalLanguage || (parsedMetadata?.vocalLanguage as string) || undefined,
        seed: cached?.seed || (parsedMetadata?.seed as number) || undefined,
        taskType: cached?.taskType || (parsedMetadata?.taskType as string) || undefined,
        lrc: cached?.lrc || (parsedMetadata?.lrc as string) || undefined,
        qualityScore: cached?.qualityScore || (parsedMetadata?.qualityScore as number) || undefined,
        engine: (parsedMetadata?.engine as string) || 'acestep',
        cover: (parsedMetadata?.cover as string) || '/covers/got/direwolf.jpg',
        createdAt: cached?.createdAt || (a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt),
      }
    }

    // 3. Resolve Story origin data if type is 'story' or 'stories'
    let storyData: Record<string, unknown> | undefined = undefined
    if (a.type === 'story' || a.type === 'stories') {
      const storyId = a.originId || a.id.replace(/^act-story-/, '').replace(/^act-/, '')
      storyData = {
        id: storyId,
        title: a.title,
        subtitle: (parsedMetadata?.subtitle as string) || a.description || undefined,
        narrator: (parsedMetadata?.narrator as string) || a.subCategory || 'Narrator',
        duration: (parsedMetadata?.duration as string) || 'Story',
        audioUrl: (parsedMetadata?.audioUrl as string) || undefined,
        cover: (parsedMetadata?.cover as string) || '/covers/got/winterfell.jpg',
        text: a.description || (parsedMetadata?.text as string) || undefined,
        chapters: Array.isArray(parsedMetadata?.chapters) ? parsedMetadata.chapters : [],
        model: (parsedMetadata?.model as string) || undefined,
        engine: (parsedMetadata?.engine as string) || undefined,
        characterVoices: Array.isArray(parsedMetadata?.characterVoices) ? parsedMetadata.characterVoices : undefined,
        backgroundMusicUrl: (parsedMetadata?.backgroundMusicUrl as string) || undefined,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
      }
    }

    // Canonical related data
    const relatedData =
      ttsData ||
      musicData ||
      storyData ||
      (parsedMetadata ? { ...parsedMetadata } : undefined)

    return {
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description || undefined,
      category: a.category || undefined,
      subCategory: a.subCategory || undefined,
      originId: a.originId || undefined,
      originType: a.originType || undefined,
      conversationId: a.conversationId || undefined,
      metadata: parsedMetadata,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
      updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : a.updatedAt,
      // Related origin data returned when fetching activities
      data: relatedData,
      origin: relatedData,
      tts: ttsData,
      music: musicData,
      story: storyData,
    }
  }

  /**
   * Automatically ensure all origins (e.g. Conversation, Music) have corresponding 1-to-1 Activity records
   */
  private async syncMissingOrigins(): Promise<void> {
    try {
      // 1. Sync unlinked Conversations to Activity
      const existingActivities = await this.db.client.activity.findMany({
        where: {
          OR: [{ conversationId: { not: null } }, { type: 'tts' }],
        },
        select: {
          conversationId: true,
          originId: true,
        },
      })

      const linkedIds = new Set<string>()
      for (const act of existingActivities) {
        const item = act as { conversationId?: string | null; originId?: string | null }
        if (item.conversationId) linkedIds.add(item.conversationId)
        if (item.originId) linkedIds.add(item.originId)
      }

      const unlinkedConversations = await this.db.client.conversation.findMany({
        where:
          linkedIds.size > 0
            ? {
                id: {
                  notIn: Array.from(linkedIds),
                },
              }
            : undefined,
        include: {
          rounds: {
            orderBy: { roundOrder: 'asc' },
          },
        },
      })

      for (const conv of unlinkedConversations) {
        const rawSnippet = conv.previewSnippet || conv.text || ''
        const cleanSnippet = rawSnippet.replace(/\s+/g, ' ').trim()
        const baseTitle = cleanSnippet
          ? cleanSnippet.length > 55
            ? `${cleanSnippet.slice(0, 52)}...`
            : cleanSnippet
          : `${conv.voiceName || 'Speech Synthesis'} Turn`

        let uniqueTitle = baseTitle
        let counter = 1
        while (await this.db.client.activity.findUnique({ where: { title: uniqueTitle } })) {
          counter++
          uniqueTitle = `${baseTitle} #${counter}`
        }

        const activityMetadata = JSON.stringify({
          model: conv.model,
          engine: conv.engine,
          duration: conv.duration,
          durationSec: conv.durationSec,
          emotion: conv.emotion,
          audioUrl: conv.audioUrl,
          waveform: conv.waveform ? JSON.parse(conv.waveform) : [],
          speakerCount: conv.speakerCount,
        })

        await this.db.client.activity.create({
          data: {
            id: `act-${conv.id}`,
            type: 'tts',
            title: uniqueTitle,
            category: 'Text to Speech',
            subCategory: conv.speakerCount > 1 ? `${conv.speakerCount} Speakers Diarized` : conv.voiceName,
            description: cleanSnippet ? cleanSnippet.slice(0, 160) : null,
            originId: conv.id,
            originType: 'conversation',
            conversationId: conv.id,
            metadata: activityMetadata,
          },
        })
      }

      // 2. Sync Music history if MusicService is available
      if (this.musicService) {
        const history = this.musicService.listHistory()
        for (const item of history) {
          const actId = `act-music-${item.id}`
          const existing = await this.db.client.activity.findFirst({
            where: {
              OR: [{ id: actId }, { originId: item.id }],
            },
          })

          if (!existing) {
            const rawCaption = item.caption || 'Music Track'
            const baseTitle = rawCaption.length > 50 ? `${rawCaption.slice(0, 47)}...` : rawCaption
            let uniqueTitle = baseTitle
            let counter = 1
            while (await this.db.client.activity.findUnique({ where: { title: uniqueTitle } })) {
              counter++
              uniqueTitle = `${baseTitle} #${counter}`
            }

            const mediaAudioUrl = item.wavFilePath
              ? `echo-media://${item.wavFilePath}`
              : (item.audioUrl && item.audioUrl.length > 50000 ? '' : item.audioUrl)

            await this.db.client.activity.create({
              data: {
                id: actId,
                type: 'music',
                title: uniqueTitle,
                description: item.lyrics ? item.lyrics.slice(0, 160) : item.caption,
                category: 'Music Generation',
                subCategory: 'AudioGen',
                originId: item.id,
                originType: 'music',
                metadata: JSON.stringify({
                  taskId: item.taskId,
                  caption: item.caption,
                  lyrics: item.lyrics,
                  audioUrl: mediaAudioUrl,
                  wavFilePath: item.wavFilePath,
                  durationMs: item.durationMs,
                  duration: item.durationMs ? `${Math.round(item.durationMs / 1000)}s` : 'Audio',
                  waveform: item.waveform || [],
                  bpm: item.bpm,
                  keyscale: item.keyscale,
                  timesignature: item.timesignature,
                  vocalLanguage: item.vocalLanguage,
                }),
              },
            })
          }
        }
      }
    } catch (err: unknown) {
      console.warn('[ActivityRepositoryService] Error syncing missing origins:', err)
    }
  }

  /**
   * Query all activities ordered by latest creation date, including origin relations
   */
  public async listActivities(): Promise<Record<string, unknown>[]> {
    await this.db.init()
    try {
      await this.syncMissingOrigins()

      const records = await this.db.client.activity.findMany({
        include: {
          conversation: {
            include: {
              rounds: {
                orderBy: { roundOrder: 'asc' },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return records.map((a) => this.formatActivityRecord(a as unknown as RawActivityRecord))
    } catch (err: unknown) {
      console.error('[ActivityRepositoryService] Failed to query activities:', err)
      return []
    }
  }

  /**
   * Find an activity by ID including related origin data
   */
  public async getActivityById(id: string): Promise<Record<string, unknown> | null> {
    await this.db.init()
    try {
      const record = await this.db.client.activity.findUnique({
        where: { id },
        include: {
          conversation: {
            include: {
              rounds: {
                orderBy: { roundOrder: 'asc' },
              },
            },
          },
        },
      })

      if (!record) return null
      return this.formatActivityRecord(record as unknown as RawActivityRecord)
    } catch (err: unknown) {
      console.error('[ActivityRepositoryService] Failed to find activity by ID:', err)
      return null
    }
  }

  /**
   * Find an activity by origin ID (e.g. conversationId) including related origin data
   */
  public async getActivityByOrigin(originId: string): Promise<Record<string, unknown> | null> {
    await this.db.init()
    try {
      const record = await this.db.client.activity.findFirst({
        where: {
          OR: [{ conversationId: originId }, { originId: originId }],
        },
        include: {
          conversation: {
            include: {
              rounds: {
                orderBy: { roundOrder: 'asc' },
              },
            },
          },
        },
      })

      if (!record) return null
      return this.formatActivityRecord(record as unknown as RawActivityRecord)
    } catch (err: unknown) {
      console.error('[ActivityRepositoryService] Failed to find activity by origin:', err)
      return null
    }
  }

  /**
   * Save or update an activity in SQLite
   */
  public async saveActivity(
    data: SaveActivityInput
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    await this.db.init()
    try {
      const metadataStr = data.metadata
        ? typeof data.metadata === 'string'
          ? data.metadata
          : JSON.stringify(data.metadata)
        : null

      // Ensure title uniqueness
      let finalTitle = data.title.trim()
      let counter = 1
      let isUnique = false
      while (!isUnique) {
        const existing = await this.db.client.activity.findUnique({
          where: { title: finalTitle },
        })
        if (!existing || existing.id === data.id) {
          isUnique = true
        } else {
          counter++
          finalTitle = `${data.title.trim()} #${counter}`
        }
      }

      const defaultCategory =
        data.category || (data.type === 'music' ? 'Music Generation' : 'Text to Speech')

      const record = await this.db.client.activity.upsert({
        where: { id: data.id },
        update: {
          type: data.type,
          title: finalTitle,
          description: data.description || null,
          category: defaultCategory,
          subCategory: data.subCategory || null,
          originId: data.originId || data.conversationId || null,
          originType: data.originType || (data.conversationId ? 'conversation' : data.type),
          conversationId: data.conversationId || null,
          metadata: metadataStr,
        },
        create: {
          id: data.id,
          type: data.type,
          title: finalTitle,
          description: data.description || null,
          category: defaultCategory,
          subCategory: data.subCategory || null,
          originId: data.originId || data.conversationId || null,
          originType: data.originType || (data.conversationId ? 'conversation' : data.type),
          conversationId: data.conversationId || null,
          metadata: metadataStr,
        },
      })

      return { success: true, data: this.formatActivityRecord(record as unknown as RawActivityRecord) }
    } catch (err: unknown) {
      console.error('[ActivityRepositoryService] Failed to save activity:', err)
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  /**
   * Delete an activity by ID
   */
  public async deleteActivity(id: string): Promise<{ success: boolean; error?: string }> {
    await this.db.init()
    try {
      await this.db.client.activity.delete({
        where: { id },
      })
      return { success: true }
    } catch (err: unknown) {
      console.error('[ActivityRepositoryService] Failed to delete activity:', err)
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }
}
