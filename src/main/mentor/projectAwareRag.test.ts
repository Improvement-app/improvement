import { describe, expect, it, vi } from 'vitest'
import type { Project } from '../../shared/projects'
import type { CapturedResource } from '../../shared/resources'
import {
  searchProjectAwareResources,
  type RagProjectRepository,
  type RagResourceRepository
} from './projectAwareRag'

function resource(id: string, title: string): CapturedResource {
  return {
    id,
    type: 'transcript',
    source: 'youtube',
    title,
    content: `${title} content`,
    capturedAt: '2026-05-04T12:00:00.000Z',
    metadata: {},
    tags: ['transcript']
  }
}

const activeProject: Project = {
  id: 'project-1',
  title: 'Vehicle Dynamics Study',
  description: '',
  type: 'course',
  status: 'active',
  createdAt: '2026-05-04T12:00:00.000Z',
  notes: ''
}

function createResourceRepository(input: {
  projectResources?: CapturedResource[]
  globalResources?: CapturedResource[]
}): RagResourceRepository {
  return {
    searchRelevantByIds: vi.fn().mockResolvedValue(input.projectResources ?? []),
    searchRelevant: vi.fn().mockResolvedValue(input.globalResources ?? [])
  }
}

function createProjectRepository(project: Project | null = activeProject): RagProjectRepository {
  return {
    getById: vi.fn().mockResolvedValue(project),
    getLinkedResourceIds: vi.fn().mockReturnValue(['project-resource'])
  }
}

describe('searchProjectAwareResources', () => {
  it('returns active project matches before broader library fallback', async () => {
    const projectResource = resource('project-resource', 'Roll Center Notes')
    const globalResource = resource('global-resource', 'Brake Bias Fundamentals')
    const resourceRepository = createResourceRepository({
      projectResources: [projectResource],
      globalResources: [globalResource, projectResource]
    })
    const projectRepository = createProjectRepository()

    await expect(
      searchProjectAwareResources({
        query: 'How should I think about roll center and brake bias?',
        activeProjectId: activeProject.id,
        resourceRepository,
        projectRepository,
        limit: 2
      })
    ).resolves.toMatchObject({
      resources: [
        {
          id: 'project-resource'
        },
        {
          id: 'global-resource'
        }
      ],
      projectMatchCount: 1,
      activeProjectId: activeProject.id
    })
    expect(resourceRepository.searchRelevantByIds).toHaveBeenCalledWith(
      'How should I think about roll center and brake bias?',
      ['project-resource'],
      2
    )
  })

  it('falls back to global resources when there is no active project', async () => {
    const globalResource = resource('global-resource', 'Welding Reference')
    const resourceRepository = createResourceRepository({
      globalResources: [globalResource]
    })
    const projectRepository = createProjectRepository()

    await expect(
      searchProjectAwareResources({
        query: 'welding setup',
        activeProjectId: null,
        resourceRepository,
        projectRepository,
        limit: 5
      })
    ).resolves.toMatchObject({
      resources: [
        {
          id: 'global-resource'
        }
      ],
      projectMatchCount: 0
    })
    expect(resourceRepository.searchRelevantByIds).not.toHaveBeenCalled()
  })

  it('falls back to global resources when the active project no longer exists', async () => {
    const resourceRepository = createResourceRepository({
      globalResources: [resource('global-resource', 'Suspension Geometry')]
    })

    await expect(
      searchProjectAwareResources({
        query: 'suspension',
        activeProjectId: 'missing-project',
        resourceRepository,
        projectRepository: createProjectRepository(null),
        limit: 5
      })
    ).resolves.toMatchObject({
      resources: [
        {
          id: 'global-resource'
        }
      ],
      projectMatchCount: 0
    })
  })
})
