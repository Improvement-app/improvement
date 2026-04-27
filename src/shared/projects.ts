import type { CapturedResource } from './resources'

export type ProjectType = 'course' | 'build' | 'skill' | 'general'
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

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
  linkedAt: string
  notes: string
  relevanceScore: number
}

export interface ProjectResourceLink extends ResourceLink {
  project: Project
}

export interface LinkedProjectResources {
  project: Project
  resources: CapturedResource[]
}
