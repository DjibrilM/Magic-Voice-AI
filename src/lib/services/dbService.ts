import { HistoryEntry, Voice } from '../interfaces/voice'
import { Activity } from '../interfaces/activity'

export class DbService {
  /**
   * Load all activities from SQLite database via IPC
   */
  public async getActivities(): Promise<Activity[]> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('activity:list')
        if (res?.success && Array.isArray(res.data)) {
          return res.data
        }
      } catch (err) {
        console.error('[DbService] Failed to load activities from SQLite:', err)
      }
    }
    return []
  }

  /**
   * Get a single activity by origin ID (e.g. conversationId)
   */
  public async getActivityByOrigin(originId: string): Promise<Activity | null> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('activity:get-by-origin', { originId })
        if (res?.success && res.data) {
          return res.data
        }
      } catch (err) {
        console.error('[DbService] Failed to get activity by origin from SQLite:', err)
      }
    }
    return null
  }

  /**
   * Delete an activity from SQLite
   */
  public async deleteActivity(id: string): Promise<boolean> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('activity:delete', { id })
        return !!res?.success
      } catch (err) {
        console.error('[DbService] Failed to delete activity from SQLite:', err)
        return false
      }
    }
    return false
  }
  /**
   * Load all saved conversations from SQLite database via IPC
   */
  public async getSavedConversations(): Promise<HistoryEntry[]> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('tts:history:list')
        if (res?.success && Array.isArray(res.data)) {
          return res.data
        }
      } catch (err) {
        console.error('[DbService] Failed to load conversations from SQLite:', err)
      }
    }
    return []
  }

  /**
   * Save or update a conversation with all speaker rounds in SQLite
   */
  public async saveConversation(entry: HistoryEntry): Promise<boolean> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('tts:history:save', {
          id: entry.id,
          text: entry.text,
          previewSnippet: entry.previewSnippet || entry.text,
          voiceName: entry.voiceName,
          voiceColor: entry.voiceColor,
          voiceAvatarUrl: entry.voiceAvatarUrl,
          dateGroup: entry.dateGroup,
          timeAgo: entry.timeAgo,
          timestamp: entry.timestamp,
          model: entry.model,
          engine: entry.engine || 'cosyvoice3',
          duration: entry.duration,
          durationSec: entry.durationSec,
          emotion: entry.emotion,
          audioUrl: entry.audioUrl,
          waveform: entry.waveform,
          voicePrompt: entry.voicePrompt,
          language: entry.language,
          speakerCount: entry.speakerCount || 1,
          generationId: entry.generationId,
          roundsData: entry.roundsData,
        })
        return !!res?.success
      } catch (err) {
        console.error('[DbService] Failed to save conversation to SQLite:', err)
        return false
      }
    }
    return false
  }

  /**
   * Delete a conversation from SQLite
   */
  public async deleteConversation(id: string): Promise<boolean> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('tts:history:delete', { id })
        return !!res?.success
      } catch (err) {
        console.error('[DbService] Failed to delete conversation from SQLite:', err)
        return false
      }
    }
    return false
  }

  /**
   * Clear all conversations from SQLite
   */
  public async clearConversations(): Promise<boolean> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('tts:history:clear')
        return !!res?.success
      } catch (err) {
        console.error('[DbService] Failed to clear conversations from SQLite:', err)
        return false
      }
    }
    return false
  }

  /**
   * Load all custom cloned voices from SQLite
   */
  public async getCustomVoices(): Promise<Voice[]> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('db:voices:list')
        if (res?.success && Array.isArray(res.data)) {
          return res.data
        }
      } catch (err) {
        console.error('[DbService] Failed to load custom voices from SQLite:', err)
      }
    }
    return []
  }

  /**
   * Save a custom cloned voice to SQLite
   */
  public async saveCustomVoice(voice: Voice): Promise<boolean> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('db:voices:save', voice)
        return !!res?.success
      } catch (err) {
        console.error('[DbService] Failed to save custom voice to SQLite:', err)
        return false
      }
    }
    return false
  }

  /**
   * Delete a custom voice from SQLite
   */
  public async deleteCustomVoice(id: string): Promise<boolean> {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        const res = await window.ipcRenderer.invoke('db:voices:delete', { id })
        return !!res?.success
      } catch (err) {
        console.error('[DbService] Failed to delete custom voice from SQLite:', err)
        return false
      }
    }
    return false
  }
}

export const dbService = new DbService()
