import type { CapturedResource } from './resources'

export type ProjectType = 'course' | 'build' | 'skill' | 'general'
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type LearningGoalStatus = 'todo' | 'in-progress' | 'done'

export interface Project {
  id: string
  title: string
  description: string
  type: ProjectType
  status: ProjectStatus
  createdAt: string
  targetDate?: string
  notes: string
}

export type ProjectInput = Omit<Project, 'id' | 'createdAt' | 'status'> & {
  id?: string
  status?: ProjectStatus
  createdAt?: string
}

export type ProjectUpdate = Partial<Omit<Project, 'id' | 'createdAt'>> & {
  id: string
}

export interface ResourceLink {
  id: string
  resourceId: string
  projectId: string
  learningGoalId?: string
  linkedAt: string
  notes: string
  relevanceScore: number
}

export interface ProjectResourceLink extends ResourceLink {
  project: Project
  learningGoal?: LearningGoal
}

export interface LinkedProjectResources {
  project: Project
  resources: CapturedResource[]
}

export interface LearningGoal {
  id: string
  projectId: string
  title: string
  description: string
  status: LearningGoalStatus
  priority: number
  createdAt: string
  completedAt?: string
  notes: string
}

export type LearningGoalInput = Omit<LearningGoal, 'id' | 'status' | 'createdAt' | 'completedAt'> & {
  id?: string
  status?: LearningGoalStatus
  createdAt?: string
  completedAt?: string
}

export type LearningGoalUpdate = Partial<Omit<LearningGoal, 'projectId' | 'createdAt'>> & {
  id: string
}

export interface ProjectProgress {
  projectId: string
  totalGoals: number
  completedGoals: number
  percentComplete: number
}
