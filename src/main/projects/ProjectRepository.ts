import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type {
  KnowledgeGapDetectedBy,
  KnowledgeGapRecommendation,
  KnowledgeGapSeverity,
  KnowledgeGapStatus
} from '../../shared/knowledgeGaps'
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

interface KnowledgeGapRow {
  id: string
  project_id: string
  title: string
  description: string | null
  recommendation: string
  status: KnowledgeGapStatus
  severity: KnowledgeGapSeverity
  detected_by: KnowledgeGapDetectedBy
  evidence_json: string
  created_at: string
  updated_at: string
  metadata_json: string
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

  getLinkedResourceIds(projectId: string): string[] {
    const rows = this.db
      .prepare('SELECT resource_id FROM resource_links WHERE project_id = ?')
      .all(projectId) as { resource_id: string }[]
    return rows.map((row) => row.resource_id)
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
      const next = {
        ...this.linkFromRow(existing),
        notes: input.notes?.trim() ?? existing.notes ?? '',
        relevanceScore: input.relevanceScore ?? existing.relevance_score
      }
      this.db
        .prepare(
          `UPDATE resource_links
           SET notes = @notes,
               relevance_score = @relevanceScore
           WHERE id = @id`
        )
        .run(this.linkParams(next))

      return next
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

  async syncKnowledgeGaps(projectId: string, gaps: KnowledgeGapRecommendation[]): Promise<KnowledgeGapRecommendation[]> {
    const detectedIds = new Set(gaps.map((gap) => gap.id))

    for (const gap of gaps) {
      await this.upsertKnowledgeGap(gap)
    }

    const activeGaps = await this.getKnowledgeGapsForProject(projectId, ['open', 'in_progress'])

    return activeGaps.filter((gap) => detectedIds.has(gap.id) || gap.status === 'in_progress')
  }

  async updateKnowledgeGapStatus(id: string, status: KnowledgeGapStatus): Promise<KnowledgeGapRecommendation | null> {
    const existing = await this.getKnowledgeGapById(id)

    if (!existing) {
      return null
    }

    const next: KnowledgeGapRecommendation = {
      ...existing,
      status,
      updatedAt: new Date().toISOString()
    }

    this.db
      .prepare(
        `UPDATE knowledge_gaps
         SET status = @status,
             updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id: next.id,
        status: next.status,
        updatedAt: next.updatedAt
      })

    return next
  }

  async getKnowledgeGapsForProject(
    projectId: string,
    statuses: KnowledgeGapStatus[] = ['open', 'in_progress', 'resolved', 'dismissed']
  ): Promise<KnowledgeGapRecommendation[]> {
    const uniqueStatuses = Array.from(new Set(statuses))
    if (uniqueStatuses.length === 0) {
      return []
    }

    const statusParams = Object.fromEntries(uniqueStatuses.map((status, index) => [`status${index}`, status]))
    const statusPlaceholders = uniqueStatuses.map((_status, index) => `@status${index}`).join(', ')
    const rows = this.db
      .prepare(
        `SELECT *
         FROM knowledge_gaps
         WHERE project_id = @projectId
           AND status IN (${statusPlaceholders})
         ORDER BY
           CASE status
             WHEN 'in_progress' THEN 0
             WHEN 'open' THEN 1
             WHEN 'resolved' THEN 2
             ELSE 3
           END,
           severity DESC,
           updated_at DESC`
      )
      .all({ projectId, ...statusParams }) as KnowledgeGapRow[]

    return rows.map((row) => this.knowledgeGapFromRow(row))
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

      CREATE TABLE IF NOT EXISTS knowledge_gaps (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        recommendation TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
        severity INTEGER NOT NULL DEFAULT 0,
        detected_by TEXT NOT NULL,
        evidence_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_project ON knowledge_gaps(project_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_status ON knowledge_gaps(status);
    `)
  }

  private async upsertKnowledgeGap(gap: KnowledgeGapRecommendation): Promise<KnowledgeGapRecommendation> {
    const existing = await this.getKnowledgeGapById(gap.id)

    if (existing) {
      const next: KnowledgeGapRecommendation = {
        ...gap,
        status: existing.status,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      }

      this.db
        .prepare(
          `UPDATE knowledge_gaps
           SET title = @title,
               description = @description,
               recommendation = @recommendation,
               status = @status,
               severity = @severity,
               detected_by = @detectedBy,
               evidence_json = @evidenceJson,
               updated_at = @updatedAt,
               metadata_json = @metadataJson
           WHERE id = @id`
        )
        .run(this.knowledgeGapParams(next))

      return next
    }

    this.db
      .prepare(
        `INSERT INTO knowledge_gaps (
          id, project_id, title, description, recommendation, status, severity,
          detected_by, evidence_json, created_at, updated_at, metadata_json
        ) VALUES (
          @id, @projectId, @title, @description, @recommendation, @status, @severity,
          @detectedBy, @evidenceJson, @createdAt, @updatedAt, @metadataJson
        )`
      )
      .run(this.knowledgeGapParams(gap))

    return gap
  }

  private async getKnowledgeGapById(id: string): Promise<KnowledgeGapRecommendation | null> {
    const row = this.db.prepare('SELECT * FROM knowledge_gaps WHERE id = ?').get(id) as KnowledgeGapRow | undefined
    return row ? this.knowledgeGapFromRow(row) : null
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

  private knowledgeGapParams(gap: KnowledgeGapRecommendation): Record<string, unknown> {
    return {
      id: gap.id,
      projectId: gap.projectId,
      title: gap.title,
      description: gap.description,
      recommendation: gap.recommendation,
      status: gap.status,
      severity: gap.severity,
      detectedBy: gap.detectedBy,
      evidenceJson: JSON.stringify(gap.evidence),
      createdAt: gap.createdAt,
      updatedAt: gap.updatedAt,
      metadataJson: JSON.stringify(gap.metadata)
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
    const link: ProjectResourceLink = {
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

    return link
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
      tags: row.tags_json ? this.parseJsonArray(row.tags_json).map(String) : undefined,
      summary: row.summary ?? undefined
    }
  }

  private knowledgeGapFromRow(row: KnowledgeGapRow): KnowledgeGapRecommendation {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description ?? '',
      recommendation: row.recommendation,
      status: row.status,
      severity: row.severity,
      detectedBy: row.detected_by,
      evidence: this.parseJsonArray(row.evidence_json).map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? {
              type: String((item as Record<string, unknown>).type ?? 'project') as KnowledgeGapRecommendation['evidence'][number]['type'],
              id: typeof (item as Record<string, unknown>).id === 'string' ? String((item as Record<string, unknown>).id) : undefined,
              title: String((item as Record<string, unknown>).title ?? 'Evidence'),
              detail: String((item as Record<string, unknown>).detail ?? '')
            }
          : {
              type: 'project',
              title: 'Evidence',
              detail: String(item ?? '')
            }
      ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: this.parseJsonObject(row.metadata_json) as KnowledgeGapRecommendation['metadata']
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

  private parseJsonArray(value: string): unknown[] {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}
