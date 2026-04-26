import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CapturedResource } from '../../shared/resources'

interface ResourceRow {
  id: string
  type: string
  source: string
  title: string
  url: string | null
  content: string
  captured_at: string
  metadata_json: string
  tags_json: string | null
  summary: string | null
}

export class ResourceRepository {
  private readonly db: Database.Database

  constructor(userDataPath: string) {
    mkdirSync(userDataPath, { recursive: true })
    this.db = new Database(join(userDataPath, 'resources.db'))
    this.db.pragma('journal_mode = WAL')
    this.initialize()
  }

  async save(resource: CapturedResource): Promise<void> {
    try {
      this.db
        .prepare(
          `INSERT INTO resources (
            id, type, source, title, url, content, captured_at, metadata_json, tags_json, summary
          ) VALUES (
            @id, @type, @source, @title, @url, @content, @capturedAt, @metadataJson, @tagsJson, @summary
          )
          ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            source = excluded.source,
            title = excluded.title,
            url = excluded.url,
            content = excluded.content,
            captured_at = excluded.captured_at,
            metadata_json = excluded.metadata_json,
            tags_json = excluded.tags_json,
            summary = excluded.summary`
        )
        .run(this.toParams(resource))
    } catch (error) {
      console.warn('Unable to save captured resource:', error)
      throw error
    }
  }

  async getById(id: string): Promise<CapturedResource | null> {
    const row = this.db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as ResourceRow | undefined
    return row ? this.fromRow(row) : null
  }

  async getAll(): Promise<CapturedResource[]> {
    const rows = this.db.prepare('SELECT * FROM resources ORDER BY captured_at DESC').all() as ResourceRow[]
    return rows.map((row) => this.fromRow(row))
  }

  async search(query: string): Promise<CapturedResource[]> {
    const trimmed = query.trim()

    if (!trimmed) {
      return this.getAll()
    }

    const like = `%${trimmed}%`
    const rows = this.db
      .prepare(
        `SELECT * FROM resources
         WHERE title LIKE @like
            OR source LIKE @like
            OR type LIKE @like
            OR url LIKE @like
            OR content LIKE @like
            OR summary LIKE @like
            OR tags_json LIKE @like
            OR metadata_json LIKE @like
         ORDER BY captured_at DESC`
      )
      .all({ like }) as ResourceRow[]

    return rows.map((row) => this.fromRow(row))
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM resources WHERE id = ?').run(id)
  }

  async getByType(type: string): Promise<CapturedResource[]> {
    const rows = this.db.prepare('SELECT * FROM resources WHERE type = ? ORDER BY captured_at DESC').all(type) as ResourceRow[]
    return rows.map((row) => this.fromRow(row))
  }

  close(): void {
    this.db.close()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT,
        content TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        tags_json TEXT,
        summary TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
      CREATE INDEX IF NOT EXISTS idx_resources_source ON resources(source);
      CREATE INDEX IF NOT EXISTS idx_resources_captured_at ON resources(captured_at);
    `)

    this.migrateLegacyTranscripts()
  }

  private migrateLegacyTranscripts(): void {
    const legacyTable = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('transcripts', 'captured_transcripts')")
      .get() as { name: string } | undefined

    if (!legacyTable) {
      return
    }

    const rows = this.db.prepare(`SELECT * FROM ${legacyTable.name}`).all() as Array<Record<string, unknown>>

    for (const row of rows) {
      const id = String(row.id ?? randomUUID())
      const existing = this.db.prepare('SELECT id FROM resources WHERE id = ?').get(id)

      if (existing) {
        continue
      }

      const title = String(row.title ?? 'Captured transcript')
      const url = typeof row.url === 'string' ? row.url : null
      const content = String(row.text ?? row.content ?? '')

      if (!content) {
        continue
      }

      this.db.prepare(
        `INSERT INTO resources (
          id, type, source, title, url, content, captured_at, metadata_json, tags_json, summary
        ) VALUES (?, 'transcript', ?, ?, ?, ?, ?, '{}', NULL, NULL)`
      ).run(id, row.source ?? 'legacy-transcript', title, url, content, row.captured_at ?? row.capturedAt ?? new Date().toISOString())
    }
  }

  private toParams(resource: CapturedResource): Record<string, unknown> {
    return {
      id: resource.id,
      type: resource.type,
      source: resource.source,
      title: resource.title,
      url: resource.url ?? null,
      content: resource.content,
      capturedAt: resource.capturedAt,
      metadataJson: JSON.stringify(resource.metadata ?? {}),
      tagsJson: resource.tags ? JSON.stringify(resource.tags) : null,
      summary: resource.summary ?? null
    }
  }

  private fromRow(row: ResourceRow): CapturedResource {
    return {
      id: row.id,
      type: row.type,
      source: row.source,
      title: row.title,
      url: row.url ?? undefined,
      content: row.content,
      capturedAt: row.captured_at,
      metadata: this.parseJsonObject(row.metadata_json),
      tags: row.tags_json ? this.parseJsonArray(row.tags_json) : undefined,
      summary: row.summary ?? undefined
    }
  }

  private parseJsonObject(value: string): Record<string, any> {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, any>) : {}
    } catch {
      return {}
    }
  }

  private parseJsonArray(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
}
