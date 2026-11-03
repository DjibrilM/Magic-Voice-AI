import { DatabaseService } from '../../db/services/db.service'

export interface SaveConversationInput {
  id: string
  text: string
  previewSnippet?: string
  voiceName: string
  voiceColor: string
  voiceAvatarUrl?: string
  dateGroup: string
  timeAgo: string
  timestamp?: number
  model: string
  engine?: string
  duration: string
  durationSec?: number
  emotion?: string
  audioUrl?: string
  waveform?: number[]
  voicePrompt?: string
  language?: string
  speakerCount?: number
  generationId?: string
  roundsData?: Array<{
    id: string
    voiceId: string
    text: string
    speed?: number
    emotion?: string
    pace?: string
    prompt?: string
    description?: string
    referenceAudioSrc?: string
    speakerName?: string
    speakerColor?: string
  }>
}

export class ConversationRepositoryService {
  private db: DatabaseService

  constructor(db: DatabaseService) {
    this.db = db
  }

  /**
   * Query all conversations and dialogue rounds from SQLite
   */
  public async listConversations(): Promise<Record<string, unknown>[]> {
    await this.db.init()
    try {
      const records = await this.db.client.conversation.findMany({
        include: {
          rounds: {
            orderBy: {
              roundOrder: 'asc',
            },
          },
          activity: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return records.map((c) => ({
        id: c.id,
        text: c.text,
        previewSnippet: c.previewSnippet || c.text,
        voiceName: c.voiceName,
        voiceColor: c.voiceColor,
        voiceAvatarUrl: c.voiceAvatarUrl || '/voices/sterling.jpg',
        dateGroup: c.dateGroup,
        timeAgo: c.timeAgo,
        timestamp: c.timestamp ? Number(c.timestamp) : c.createdAt.getTime(),
        model: c.model,
        engine: c.engine,
        duration: c.duration,
        durationSec: c.durationSec || 0,
        emotion: c.emotion || undefined,
        audioUrl: c.audioUrl || undefined,
        waveform: c.waveform ? JSON.parse(c.waveform) : [],
        voicePrompt: c.voicePrompt || undefined,
        language: c.language || undefined,
        speakerCount: c.speakerCount,
        generationId: c.generationId || undefined,
        activity: c.activity
          ? {
              id: c.activity.id,
              type: c.activity.type,
              title: c.activity.title,
              category: c.activity.category,
              subCategory: c.activity.subCategory,
              description: c.activity.description,
            }
          : undefined,
        roundsData: c.rounds.map((r) => ({
          id: r.id,
          voiceId: r.voiceId,
          text: r.text,
          speed: r.speed,
          emotion: r.emotion || undefined,
          pace: r.pace || undefined,
          prompt: r.prompt || undefined,
          description: r.description || undefined,
          referenceAudioSrc: r.referenceAudioSrc || undefined,
          speakerName: r.speakerName || undefined,
          speakerColor: r.speakerColor || undefined,
        })),
      }))
    } catch (err) {
      console.error('[ConversationRepositoryService] Failed to query conversations:', err)
      return []
    }
  }

  /**
   * Save or update a conversation with all dialogue rounds in SQLite
   */
  public async saveConversation(data: SaveConversationInput): Promise<{ success: boolean; error?: string }> {
    await this.db.init()
    try {
      const waveformJson = data.waveform ? JSON.stringify(data.waveform) : '[]'
      const timestampBigInt = data.timestamp ? BigInt(Math.floor(data.timestamp)) : BigInt(Date.now())

      await this.db.client.$transaction(async (tx) => {
        // Upsert conversation parent record
        await tx.conversation.upsert({
          where: { id: data.id },
          update: {
            text: data.text,
            previewSnippet: data.previewSnippet || data.text,
            voiceName: data.voiceName,
            voiceColor: data.voiceColor,
            voiceAvatarUrl: data.voiceAvatarUrl,
            dateGroup: data.dateGroup,
            timeAgo: data.timeAgo,
            timestamp: timestampBigInt,
            model: data.model,
            engine: data.engine || 'cosyvoice3',
            duration: data.duration,
            durationSec: data.durationSec,
            emotion: data.emotion,
            audioUrl: data.audioUrl,
            waveform: waveformJson,
            voicePrompt: data.voicePrompt,
            language: data.language,
            speakerCount: data.speakerCount || 1,
            generationId: data.generationId,
          },
          create: {
            id: data.id,
            text: data.text,
            previewSnippet: data.previewSnippet || data.text,
            voiceName: data.voiceName,
            voiceColor: data.voiceColor,
            voiceAvatarUrl: data.voiceAvatarUrl,
            dateGroup: data.dateGroup,
            timeAgo: data.timeAgo,
            timestamp: timestampBigInt,
            model: data.model,
            engine: data.engine || 'cosyvoice3',
            duration: data.duration,
            durationSec: data.durationSec,
            emotion: data.emotion,
            audioUrl: data.audioUrl,
            waveform: waveformJson,
            voicePrompt: data.voicePrompt,
            language: data.language,
            speakerCount: data.speakerCount || 1,
            generationId: data.generationId,
          },
        })

        // Replace dialogue rounds
        await tx.speechRound.deleteMany({
          where: { conversationId: data.id },
        })

        if (data.roundsData && Array.isArray(data.roundsData) && data.roundsData.length > 0) {
          const roundsToCreate = data.roundsData.map((r, idx) => ({
            id: r.id || `${data.id}-round-${idx}`,
            conversationId: data.id,
            roundOrder: idx,
            voiceId: r.voiceId || 'voice-en-male-1',
            text: r.text || '',
            speed: typeof r.speed === 'number' ? r.speed : 1.0,
            emotion: r.emotion || null,
            pace: r.pace || null,
            prompt: r.prompt || null,
            description: r.description || null,
            referenceAudioSrc: r.referenceAudioSrc || null,
            speakerName: r.speakerName || null,
            speakerColor: r.speakerColor || null,
          }))

          for (const round of roundsToCreate) {
            await tx.speechRound.create({ data: round })
          }
        }

        // Create or update 1-to-1 linked Activity record for this TTS generation
        const rawSnippet = data.previewSnippet || data.text || ''
        const cleanSnippet = rawSnippet.replace(/\s+/g, ' ').trim()
        const baseTitle = cleanSnippet
          ? cleanSnippet.length > 55
            ? `${cleanSnippet.slice(0, 52)}...`
            : cleanSnippet
          : `${data.voiceName || 'Speech Synthesis'} Turn`

        const existingActivity = await tx.activity.findUnique({
          where: { conversationId: data.id },
        })

        const activityCategory = 'Text to Speech'
        const activitySubCategory =
          data.speakerCount && data.speakerCount > 1
            ? `${data.speakerCount} Speakers Diarized`
            : (data.voiceName || 'Single Speaker')

        const activityMetadata = JSON.stringify({
          model: data.model,
          engine: data.engine || 'cosyvoice3',
          duration: data.duration,
          durationSec: data.durationSec,
          emotion: data.emotion,
          audioUrl: data.audioUrl,
          waveform: data.waveform || [],
          speakerCount: data.speakerCount || 1,
        })

        if (!existingActivity) {
          // Generate a guaranteed unique title
          let uniqueTitle = baseTitle
          let counter = 1
          while (await tx.activity.findUnique({ where: { title: uniqueTitle } })) {
            counter++
            uniqueTitle = `${baseTitle} #${counter}`
          }

          await tx.activity.create({
            data: {
              id: `act-${data.id}`,
              type: 'tts',
              title: uniqueTitle,
              category: activityCategory,
              subCategory: activitySubCategory,
              description: cleanSnippet ? cleanSnippet.slice(0, 160) : null,
              originId: data.id,
              originType: 'conversation',
              conversationId: data.id,
              metadata: activityMetadata,
            },
          })
        } else {
          await tx.activity.update({
            where: { conversationId: data.id },
            data: {
              category: activityCategory,
              subCategory: activitySubCategory,
              description: cleanSnippet ? cleanSnippet.slice(0, 160) : null,
              metadata: activityMetadata,
            },
          })
        }
      })

      return { success: true }
    } catch (err: unknown) {
      console.error('[ConversationRepositoryService] Failed to save conversation:', err)
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  /**
   * Delete a conversation from SQLite
   */
  public async deleteConversation(id: string): Promise<{ success: boolean; error?: string }> {
    await this.db.init()
    try {
      await this.db.client.conversation.delete({
        where: { id },
      })
      return { success: true }
    } catch (err: unknown) {
      console.error('[ConversationRepositoryService] Failed to delete conversation:', err)
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  /**
   * Delete all conversations from SQLite
   */
  public async clearConversations(): Promise<{ success: boolean; error?: string }> {
    await this.db.init()
    try {
      await this.db.client.conversation.deleteMany({})
      return { success: true }
    } catch (err: unknown) {
      console.error('[ConversationRepositoryService] Failed to clear conversations:', err)
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }
}
