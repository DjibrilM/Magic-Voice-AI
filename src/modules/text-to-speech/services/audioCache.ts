/**
 * IndexedDB audio cache for Text-to-Speech generation and history outputs.
 * Provides durable, unlimited storage for synthesized WAV audio payloads
 * without overflowing browser/Electron localStorage quotas.
 */

const DB_NAME = 'echo_audio_db'
const STORE_NAME = 'audio_files'
const DB_VERSION = 1

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not available in current environment'))
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Persists an audio payload (data URI or blob string) for a history or generation ID.
 */
export async function saveAudioToCache(id: string, audioUrl: string): Promise<void> {
  if (!id || !audioUrl) return
  try {
    const db = await openAudioDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(audioUrl, id)
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn('[audioCache] Failed to cache audio for', id, err)
  }
}

/**
 * Retrieves cached audio for a given history or generation ID.
 */
export async function getAudioFromCache(id: string): Promise<string | null> {
  if (!id) return null
  try {
    const db = await openAudioDb()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    return new Promise((resolve) => {
      req.onsuccess = () => resolve((req.result as string) || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Deletes cached audio for a given ID.
 */
export async function deleteAudioFromCache(id: string): Promise<void> {
  if (!id) return
  try {
    const db = await openAudioDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {}
}
