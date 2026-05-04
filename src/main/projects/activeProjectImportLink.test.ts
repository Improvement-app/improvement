import { describe, expect, it, vi } from 'vitest'
import type { Project } from '../../shared/projects'
import { linkResourceToActiveProject, type ActiveProjectImportLinkRepository } from './activeProjectImportLink'

function createRepository(project: Project | null): ActiveProjectImportLinkRepository {
  return {
    getById: vi.fn().mockResolvedValue(project),
    linkResourceToProject: vi.fn().mockResolvedValue({
      id: 'link-1',
      resourceId: 'pdf-1',
      projectId: project?.id ?? 'missing-project',
      linkedAt: '2026-05-04T12:00:00.000Z',
      notes: '',
      relevanceScore: 1
    })
  }
}

describe('linkResourceToActiveProject', () => {
  it('links an imported resource to the active project', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'Vehicle Dynamics Study',
      description: 'Course notes and PDFs.',
      type: 'course',
      status: 'active',
      createdAt: '2026-05-04T12:00:00.000Z',
      notes: ''
    }
    const repository = createRepository(project)

    await expect(linkResourceToActiveProject('pdf-1', project.id, repository)).resolves.toBe(project.id)
    expect(repository.getById).toHaveBeenCalledWith(project.id)
    expect(repository.linkResourceToProject).toHaveBeenCalledWith({
      resourceId: 'pdf-1',
      projectId: project.id
    })
  })

  it('does nothing when no active project exists', async () => {
    const repository = createRepository(null)

    await expect(linkResourceToActiveProject('pdf-1', 'missing-project', repository)).resolves.toBeUndefined()
    expect(repository.linkResourceToProject).not.toHaveBeenCalled()
  })

  it('does nothing when project storage is unavailable', async () => {
    await expect(linkResourceToActiveProject('pdf-1', 'project-1', null)).resolves.toBeUndefined()
  })
})
