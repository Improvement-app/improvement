import type { Project, ResourceLink } from '../../shared/projects'

export interface ActiveProjectImportLinkRepository {
  getById: (id: string) => Promise<Project | null>
  linkResourceToProject: (input: { resourceId: string; projectId: string }) => Promise<ResourceLink>
}

export async function linkResourceToActiveProject(
  resourceId: string,
  activeProjectId: string | null,
  projectRepository: ActiveProjectImportLinkRepository | null
): Promise<string | undefined> {
  if (!activeProjectId || !projectRepository) {
    return undefined
  }

  const project = await projectRepository.getById(activeProjectId)

  if (!project) {
    return undefined
  }

  await projectRepository.linkResourceToProject({
    resourceId,
    projectId: activeProjectId
  })

  return activeProjectId
}
