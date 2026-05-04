import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ResourceRepository } from '../resources/ResourceRepository'
import { ProjectRepository } from './ProjectRepository'

describe('ProjectRepository', () => {
  let userDataPath: string
  let resourceRepository: ResourceRepository
  let projectRepository: ProjectRepository

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'improvement-projects-'))
    resourceRepository = new ResourceRepository(userDataPath)
    projectRepository = new ProjectRepository(userDataPath)
  })

  afterEach(() => {
    projectRepository.close()
    resourceRepository.close()
    rmSync(userDataPath, { recursive: true, force: true })
  })

  async function saveResource(id = 'resource-1'): Promise<void> {
    await resourceRepository.save({
      id,
      type: 'transcript',
      source: 'youtube',
      title: 'Engine Bearing Clearance',
      url: 'https://example.com/bearings',
      content: 'Measure main bearing clearance with precision tools.',
      capturedAt: '2026-04-26T12:00:00.000Z',
      metadata: {},
      tags: ['engine']
    })
  }

  it('creates, updates, lists, and deletes projects', async () => {
    const project = await projectRepository.create({
      title: 'Rebuild my Spec Miata Engine',
      description: 'Track engine rebuild learning and decisions.',
      type: 'build',
      targetDate: '2026-08-01',
      notes: 'Focus on measurement and assembly.'
    })

    await expect(projectRepository.getById(project.id)).resolves.toMatchObject({
      title: 'Rebuild my Spec Miata Engine',
      type: 'build',
      status: 'active'
    })
    await expect(projectRepository.getAll()).resolves.toHaveLength(1)

    await expect(projectRepository.update({ id: project.id, status: 'paused', notes: 'Waiting on machine shop.' })).resolves.toMatchObject({
      status: 'paused',
      notes: 'Waiting on machine shop.'
    })

    await projectRepository.delete(project.id)
    await expect(projectRepository.getById(project.id)).resolves.toBeNull()
  })

  it('links and unlinks resources to projects', async () => {
    await saveResource()
    const project = await projectRepository.create({
      title: 'Engine Building Fundamentals',
      description: 'Course resources and notes.',
      type: 'course',
      notes: ''
    })

    const link = await projectRepository.linkResourceToProject({
      resourceId: 'resource-1',
      projectId: project.id,
      notes: 'Relevant to measurement module.',
      relevanceScore: 0.9
    })

    expect(link).toMatchObject({
      resourceId: 'resource-1',
      projectId: project.id,
      relevanceScore: 0.9
    })
    await expect(projectRepository.getLinksForResource('resource-1')).resolves.toHaveLength(1)
    await expect(projectRepository.getResourcesForProject(project.id)).resolves.toMatchObject([
      {
        id: 'resource-1',
        title: 'Engine Bearing Clearance'
      }
    ])

    await projectRepository.unlinkResourceFromProject('resource-1', project.id)
    await expect(projectRepository.getLinksForResource('resource-1')).resolves.toHaveLength(0)
    await expect(projectRepository.getResourcesForProject(project.id)).resolves.toHaveLength(0)
  })

  it('returns existing link when linking the same resource twice', async () => {
    await saveResource()
    const project = await projectRepository.create({
      title: 'Metallurgy Mastery',
      description: 'Skill deep dive.',
      type: 'skill',
      notes: ''
    })

    const first = await projectRepository.linkResourceToProject({ resourceId: 'resource-1', projectId: project.id })
    const second = await projectRepository.linkResourceToProject({ resourceId: 'resource-1', projectId: project.id })

    expect(second.id).toBe(first.id)
    await expect(projectRepository.getLinksForResource('resource-1')).resolves.toHaveLength(1)
  })

})
