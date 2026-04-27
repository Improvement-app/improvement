import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CapturedResource } from '../../shared/resources'
import type { Project, ProjectInput, ProjectResourceLink, ProjectType, ProjectUpdate, ResourceLink } from '../../shared/projects'

interface ProjectRow {
  id: string
  title: string
  description: string | null
  type: ProjectType
  status: Project['status']
  created_at: string
  target_date: string | null
  notes: string | null
}

interface ResourceLinkRow {
  id: string
  resource_id: string
  project_id: string
  linked_at: string
  notes: string | null
  relevance_score: number
}

interface ProjectResourceLinkRow extends ResourceLinkRow {
  project_title: string
  project_description: string | null
  project_type: ProjectType
  project_status: Project['status']
  project_created_at: string
  project_target_date: string | null
  project_notes: string | null
}

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

export class ProjectRepository {
  private readonly db: Database.Database

  constructor(userDataPath: string) {
    mkdirSync(userDataPath, { recursive: true })
    this.db = new Database(join(userDataPath, 'resources.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initialize()
  }

  async create(input: ProjectInput): Promise<Project> {
    const now = new Date().toISOString()
    const project: Project = {
      id: input.id ?? crypto.randomUUID(),
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      type: input.type,
      status: input.status ?? 'active',
      createdAt: input.createdAt ?? now,
      targetDate: input.targetDate || undefined,
      notes: input.notes?.trim() ?? ''
    }

    this.db
      .prepare(
        `INSERT INTO projects (
          id, title, description, type, status, created_at, target_date, notes
        ) VALUES (
          @id, @title, @description, @type, @status, @createdAt, @targetDate, @notes
        )`
      )
      .run(this.projectParams(project))

    return project
  }

  async getById(id: string): Promise<Project | null> {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
    return row ? this.projectFromRow(row) : null
  }

  async getAll(): Promise<Project[]> {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as ProjectRow[]
    return rows.map((row) => this.projectFromRow(row))
  }

  async update(update: ProjectUpdate): Promise<Project | null> {
    const existing = await this.getById(update.id)

    if (!existing) {
      return null
    }

    const next: Project = {
      ...existing,
      ...update,
      title: update.title?.trim() ?? existing.title,
      description: update.description?.trim() ?? existing.description,
      notes: update.notes?.trim() ?? existing.notes,
      targetDate: update.targetDate === undefined ? existing.targetDate : update.targetDate || undefined
    }

    this.db
      .prepare(
        `UPDATE projects
         SET title = @title,
             description = @description,
             type = @type,
             status = @status,
             target_date = @targetDate,
             notes = @notes
         WHERE id = @id`
      )
      .run(this.projectParams(next))

    return next
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  }

  async linkResourceToProject(input: {
    resourceId: string
    projectId: string
    notes?: string
    relevanceScore?: number
  }): Promise<ResourceLink> {
    const existing = this.db
      .prepare('SELECT * FROM resource_links WHERE resource_id = ? AND project_id = ?')
      .get(input.resourceId, input.projectId) as ResourceLinkRow | undefined

    if (existing) {
      return this.linkFromRow(existing)
    }

    const link: ResourceLink = {
      id: crypto.randomUUID(),
      resourceId: input.resourceId,
      projectId: input.projectId,
      linkedAt: new Date().toISOString(),
      notes: input.notes?.trim() ?? '',
      relevanceScore: input.relevanceScore ?? 1
    }

    this.db
      .prepare(
        `INSERT INTO resource_links (
          id, resource_id, project_id, linked_at, notes, relevance_score
        ) VALUES (
          @id, @resourceId, @projectId, @linkedAt, @notes, @relevanceScore
        )`
      )
      .run(this.linkParams(link))

    return link
  }

  async unlinkResourceFromProject(resourceId: string, projectId: string): Promise<void> {
    this.db.prepare('DELETE FROM resource_links WHERE resource_id = ? AND project_id = ?').run(resourceId, projectId)
  }

  async getLinksForResource(resourceId: string): Promise<ProjectResourceLink[]> {
    const rows = this.db
      .prepare(
        `SELECT resource_links.*,
                projects.title AS project_title,
                projects.description AS project_description,
                projects.type AS project_type,
                projects.status AS project_status,
                projects.created_at AS project_created_at,
                projects.target_date AS project_target_date,
                projects.notes AS project_notes
         FROM resource_links
         JOIN projects ON projects.id = resource_links.project_id
         WHERE resource_links.resource_id = ?
         ORDER BY resource_links.linked_at DESC`
      )
      .all(resourceId) as ProjectResourceLinkRow[]

    return rows.map((row) => this.projectLinkFromRow(row))
  }

  async getResourcesForProject(projectId: string): Promise<CapturedResource[]> {
    const rows = this.db
      .prepare(
        `SELECT resources.*
         FROM resource_links
         JOIN resources ON resources.id = resource_links.resource_id
         WHERE resource_links.project_id = ?
         ORDER BY resource_links.linked_at DESC`
      )
      .all(projectId) as ResourceRow[]

    return rows.map((row) => this.resourceFromRow(row))
  }

  close(): void {
    this.db.close()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL CHECK (type IN ('course', 'build', 'skill', 'general')),
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        target_date TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS resource_links (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        linked_at TEXT NOT NULL,
        notes TEXT,
        relevance_score REAL NOT NULL DEFAULT 1,
        UNIQUE(resource_id, project_id),
        FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_resource_links_resource ON resource_links(resource_id);
      CREATE INDEX IF NOT EXISTS idx_resource_links_project ON resource_links(project_id);
    `)
  }

  private projectParams(project: Project): Record<string, unknown> {
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      type: project.type,
      status: project.status,
      createdAt: project.createdAt,
      targetDate: project.targetDate ?? null,
      notes: project.notes
    }
  }

  private linkParams(link: ResourceLink): Record<string, unknown> {
    return {
      id: link.id,
      resourceId: link.resourceId,
      projectId: link.projectId,
      linkedAt: link.linkedAt,
      notes: link.notes,
      relevanceScore: link.relevanceScore
    }
  }

  private projectFromRow(row: ProjectRow): Project {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      type: row.type,
      status: row.status,
      createdAt: row.created_at,
      targetDate: row.target_date ?? undefined,
      notes: row.notes ?? ''
    }
  }

  private linkFromRow(row: ResourceLinkRow): ResourceLink {
    return {
      id: row.id,
      resourceId: row.resource_id,
      projectId: row.project_id,
      linkedAt: row.linked_at,
      notes: row.notes ?? '',
      relevanceScore: row.relevance_score
    }
  }

  private projectLinkFromRow(row: ProjectResourceLinkRow): ProjectResourceLink {
    return {
      ...this.linkFromRow(row),
      project: this.projectFromRow({
        id: row.project_id,
        title: row.project_title,
        description: row.project_description,
        type: row.project_type,
        status: row.project_status,
        created_at: row.project_created_at,
        target_date: row.project_target_date,
        notes: row.project_notes
      })
    }
  }

  private resourceFromRow(row: ResourceRow): CapturedResource {
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
