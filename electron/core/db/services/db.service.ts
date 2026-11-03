import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { app } from 'electron'
import type { PrismaClient as PrismaClientType } from '@prisma/client'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: typeof PrismaClientType
}

export interface ActivityModelDelegate {
  findMany(args?: {
    where?: Record<string, unknown>
    select?: Record<string, unknown>
    include?: Record<string, unknown>
    orderBy?: Record<string, unknown>
    take?: number
    skip?: number
  }): Promise<Array<Record<string, unknown>>>

  findUnique(args: {
    where: { id?: string; title?: string; conversationId?: string }
    include?: Record<string, unknown>
    select?: Record<string, unknown>
  }): Promise<Record<string, unknown> | null>

  findFirst(args?: {
    where?: Record<string, unknown>
    include?: Record<string, unknown>
    select?: Record<string, unknown>
  }): Promise<Record<string, unknown> | null>

  create(args: {
    data: Record<string, unknown>
    include?: Record<string, unknown>
    select?: Record<string, unknown>
  }): Promise<Record<string, unknown>>

  upsert(args: {
    where: { id: string }
    update: Record<string, unknown>
    create: Record<string, unknown>
    include?: Record<string, unknown>
    select?: Record<string, unknown>
  }): Promise<Record<string, unknown>>

  delete(args: {
    where: { id: string }
  }): Promise<Record<string, unknown>>
}

export type EchoPrismaClient = PrismaClientType & {
  activity: ActivityModelDelegate
}

export class DatabaseService {
  private prisma: PrismaClientType
  private initialized = false
  private initPromise: Promise<void> | null = null

  constructor() {
    const isPackaged = app ? app.isPackaged : false
    const dbDir = isPackaged
      ? app.getPath('userData')
      : path.join(process.cwd(), 'prisma')

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    const dbPath = path.join(dbDir, 'echo.db')
    const dbUrl = `file:${dbPath}`
    process.env.DATABASE_URL = dbUrl

    console.log(`[DatabaseService] SQLite DB initialized at: ${dbPath}`)

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: ['warn', 'error'],
    })
  }

  /**
   * Access the shared PrismaClient instance for module-specific repositories
   */
  public get client(): EchoPrismaClient {
    return this.prisma as unknown as EchoPrismaClient
  }

  /**
   * Verify and initialize core schema tables on application startup
   */
  public async init(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "conversations" (
          "id" TEXT PRIMARY KEY,
          "text" TEXT NOT NULL,
          "previewSnippet" TEXT,
          "voiceName" TEXT NOT NULL,
          "voiceColor" TEXT NOT NULL,
          "voiceAvatarUrl" TEXT,
          "dateGroup" TEXT NOT NULL,
          "timeAgo" TEXT NOT NULL,
          "timestamp" BIGINT,
          "model" TEXT NOT NULL,
          "engine" TEXT NOT NULL DEFAULT 'cosyvoice3',
          "duration" TEXT NOT NULL,
          "durationSec" REAL,
          "emotion" TEXT,
          "audioUrl" TEXT,
          "waveform" TEXT,
          "voicePrompt" TEXT,
          "language" TEXT,
          "speakerCount" INTEGER NOT NULL DEFAULT 1,
          "generationId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "speech_rounds" (
          "id" TEXT PRIMARY KEY,
          "conversationId" TEXT NOT NULL,
          "roundOrder" INTEGER NOT NULL DEFAULT 0,
          "voiceId" TEXT NOT NULL,
          "text" TEXT NOT NULL,
          "speed" REAL NOT NULL DEFAULT 1.0,
          "emotion" TEXT,
          "pace" TEXT,
          "prompt" TEXT,
          "description" TEXT,
          "referenceAudioSrc" TEXT,
          "speakerName" TEXT,
          "speakerColor" TEXT,
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
        );
      `)

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "custom_voices" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "description" TEXT NOT NULL DEFAULT '',
          "category" TEXT NOT NULL DEFAULT 'cloned',
          "color" TEXT NOT NULL DEFAULT '#38bdf8',
          "avatarUrl" TEXT NOT NULL DEFAULT '/voices/sterling.jpg',
          "initials" TEXT NOT NULL DEFAULT 'CV',
          "gender" TEXT NOT NULL DEFAULT 'Neutral',
          "tags" TEXT NOT NULL DEFAULT '[]',
          "referenceAudioName" TEXT,
          "sampleUrl" TEXT,
          "languageCode" TEXT,
          "languageName" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "user_preferences" (
          "key" TEXT PRIMARY KEY,
          "value" TEXT NOT NULL,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "activities" (
          "id" TEXT PRIMARY KEY,
          "type" TEXT NOT NULL,
          "title" TEXT NOT NULL UNIQUE,
          "description" TEXT,
          "category" TEXT DEFAULT 'Text to Speech',
          "subCategory" TEXT,
          "originId" TEXT,
          "originType" TEXT,
          "metadata" TEXT,
          "conversationId" TEXT UNIQUE,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
        );
      `)

      this.initialized = true
      console.log('[DatabaseService] SQLite database schema initialized')
    } catch (err) {
      console.error('[DatabaseService] Error verifying SQLite tables:', err)
    } finally {
      this.initPromise = null
    }
  })()

  return this.initPromise
}

  /**
   * Graceful disconnect on application exit
   */
  public async close(): Promise<void> {
    try {
      await this.prisma.$disconnect()
    } catch (err: unknown) {
      console.warn('[DatabaseService] Failed to disconnect cleanly:', err)
    }
  }
}
