import type { Project } from '../../shared/projects'
import type { CapturedResource } from '../../shared/resources'

export interface RagResourceRepository {
  searchRelevant: (query: string, limit?: number) => Promise<CapturedResource[]>
  searchRelevantByIds: (query: string, resourceIds: string[], limit?: number) => Promise<CapturedResource[]>
}

export interface RagProjectRepository {
  getById: (id: string) => Promise<Project | null>
  getLinkedResourceIds: (projectId: string) => string[]
}

export interface ProjectAwareRagResult {
  resources: CapturedResource[]
  projectMatchCount: number
  activeProjectId?: string
}

export async function searchProjectAwareResources(input: {
  query: string
  activeProjectId: string | null
  resourceRepository: RagResourceRepository | null
  projectRepository: RagProjectRepository | null
  limit?: number
}): Promise<ProjectAwareRagResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 5, 20))

  if (!input.resourceRepository) {
    return {
      resources: [],
      projectMatchCount: 0
    }
  }

  const projectResources = await searchActiveProjectResources(input, limit)
  const remaining = limit - projectResources.resources.length

  if (remaining <= 0) {
    return projectResources
  }

  const projectResourceIds = new Set(projectResources.resources.map((resource) => resource.id))
  const globalResources = await input.resourceRepository.searchRelevant(
    input.query,
    Math.min(20, limit + projectResources.resources.length)
  )
  const fallbackResources = globalResources
    .filter((resource) => !projectResourceIds.has(resource.id))
    .slice(0, remaining)

  return {
    resources: [...projectResources.resources, ...fallbackResources],
    projectMatchCount: projectResources.projectMatchCount,
    activeProjectId: projectResources.activeProjectId
  }
}

async function searchActiveProjectResources(
  input: {
    query: string
    activeProjectId: string | null
    resourceRepository: RagResourceRepository | null
    projectRepository: RagProjectRepository | null
  },
  limit: number
): Promise<ProjectAwareRagResult> {
  if (!input.activeProjectId || !input.resourceRepository || !input.projectRepository) {
    return {
      resources: [],
      projectMatchCount: 0
    }
  }

  const project = await input.projectRepository.getById(input.activeProjectId)

  if (!project) {
    return {
      resources: [],
      projectMatchCount: 0
    }
  }

  const projectResourceIds = input.projectRepository.getLinkedResourceIds(project.id)
  const resources = await input.resourceRepository.searchRelevantByIds(input.query, projectResourceIds, limit)

  return {
    resources,
    projectMatchCount: resources.length,
    activeProjectId: project.id
  }
}
