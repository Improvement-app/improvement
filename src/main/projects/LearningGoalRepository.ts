import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { LearningGoal, LearningGoalInput, LearningGoalStatus, LearningGoalUpdate, ProjectProgress } from '../../shared/projects'

interface LearningGoalRow {
  id: string
  project_id: string
  title: string
  description: string | null
  status: LearningGoalStatus
  priority: number
  created_at: string
  completed_at: string | null
  notes: string | null
}

export class LearningGoalRepository {
  private readonly db: Database.Database

  constructor(userDataPath: string) {
    mkdirSync(userDataPath, { recursive: true })
    this.db = new Database(join(userDataPath, 'resources.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initialize()
  }

  async create(input: LearningGoalInput): Promise<LearningGoal> {
    const goal: LearningGoal = {
      id: input.id ?? crypto.randomUUID(),
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: input.status ?? 'todo',
      priority: this.normalizePriority(input.priority),
      createdAt: input.createdAt ?? new Date().toISOString(),
      completedAt: input.completedAt,
      notes: input.notes?.trim() ?? ''
    }

    this.db
      .prepare(
        `INSERT INTO learning_goals (
          id, project_id, title, description, status, priority, created_at, completed_at, notes
        ) VALUES (
          @id, @projectId, @title, @description, @status, @priority, @createdAt, @completedAt, @notes
        )`
      )
      .run(this.toParams(goal))

    return goal
  }

  async getById(id: string): Promise<LearningGoal | null> {
    const row = this.db.prepare('SELECT * FROM learning_goals WHERE id = ?').get(id) as LearningGoalRow | undefined
    return row ? this.fromRow(row) : null
  }

  async getByProjectId(projectId: string): Promise<LearningGoal[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM learning_goals
         WHERE project_id = ?
         ORDER BY status = 'done', priority DESC, created_at DESC`
      )
      .all(projectId) as LearningGoalRow[]

    return rows.map((row) => this.fromRow(row))
  }

  async update(update: LearningGoalUpdate): Promise<LearningGoal | null> {
    const existing = await this.getById(update.id)

    if (!existing) {
      return null
    }

    const nextStatus = update.status ?? existing.status
    const next: LearningGoal = {
      ...existing,
      ...update,
      title: update.title?.trim() ?? existing.title,
      description: update.description?.trim() ?? existing.description,
      status: nextStatus,
      priority: update.priority === undefined ? existing.priority : this.normalizePriority(update.priority),
      completedAt: this.completedAtForStatus(nextStatus, update.completedAt, existing.completedAt),
      notes: update.notes?.trim() ?? existing.notes
    }

    this.db
      .prepare(
        `UPDATE learning_goals
         SET title = @title,
             description = @description,
             status = @status,
             priority = @priority,
             completed_at = @completedAt,
             notes = @notes
         WHERE id = @id`
      )
      .run(this.toParams(next))

    return next
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM learning_goals WHERE id = ?').run(id)
  }

  async markComplete(id: string): Promise<LearningGoal | null> {
    return this.update({ id, status: 'done', completedAt: new Date().toISOString() })
  }

  async getProjectProgress(projectId: string): Promise<ProjectProgress> {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS totalGoals,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completedGoals
         FROM learning_goals
         WHERE project_id = ?`
      )
      .get(projectId) as { totalGoals: number; completedGoals: number | null }

    const totalGoals = row.totalGoals
    const completedGoals = row.completedGoals ?? 0

    return {
      projectId,
      totalGoals,
      completedGoals,
      percentComplete: totalGoals === 0 ? 0 : Math.round((completedGoals / totalGoals) * 100)
    }
  }

  close(): void {
    this.db.close()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_goals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
        priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
        created_at TEXT NOT NULL,
        completed_at TEXT,
        notes TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_learning_goals_project ON learning_goals(project_id);
      CREATE INDEX IF NOT EXISTS idx_learning_goals_status ON learning_goals(status);
    `)

    // Phase 2 lets a project-level resource link optionally point at a goal.
    // Existing Phase 1 databases have resource_links without this column.
    const columns = this.db.prepare('PRAGMA table_info(resource_links)').all() as Array<{ name: string }>
    if (columns.length > 0 && !columns.some((column) => column.name === 'learning_goal_id')) {
      this.db.exec('ALTER TABLE resource_links ADD COLUMN learning_goal_id TEXT REFERENCES learning_goals(id) ON DELETE SET NULL')
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_resource_links_learning_goal ON resource_links(learning_goal_id)')
    }
  }

  private toParams(goal: LearningGoal): Record<string, unknown> {
    return {
      id: goal.id,
      projectId: goal.projectId,
      title: goal.title,
      description: goal.description,
      status: goal.status,
      priority: goal.priority,
      createdAt: goal.createdAt,
      completedAt: goal.completedAt ?? null,
      notes: goal.notes
    }
  }

  private fromRow(row: LearningGoalRow): LearningGoal {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description ?? '',
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
      notes: row.notes ?? ''
    }
  }

  private normalizePriority(priority: number): number {
    return Math.max(1, Math.min(5, Math.round(priority || 3)))
  }

  private completedAtForStatus(status: LearningGoalStatus, requested?: string, existing?: string): string | undefined {
    if (status === 'done') {
      return requested ?? existing ?? new Date().toISOString()
    }

    return undefined
  }
}
