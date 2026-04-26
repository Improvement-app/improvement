import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CapturedResource } from '../../shared/resources'
import { ResourceRepository } from './ResourceRepository'

describe('ResourceRepository', () => {
  let userDataPath: string
  let repository: ResourceRepository

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'improvement-resources-'))
    repository = new ResourceRepository(userDataPath)
  })

  afterEach(() => {
    repository.close()
    rmSync(userDataPath, { recursive: true, force: true })
  })

  function transcript(overrides: Partial<CapturedResource> = {}): CapturedResource {
    return {
      id: 'resource-1',
      type: 'transcript',
      source: 'youtube',
      title: 'Chassis Setup Explained',
      url: 'https://www.youtube.com/watch?v=abc123',
      content: 'Transcript text about suspension geometry.',
      capturedAt: '2026-04-26T12:00:00.000Z',
      metadata: { videoId: 'abc123', durationSeconds: 420 },
      tags: ['transcript', 'vehicle-dynamics'],
      ...overrides
    }
  }

  it('saves and loads captured resources', async () => {
    await repository.save(transcript())

    await expect(repository.getById('resource-1')).resolves.toEqual(transcript())
    await expect(repository.getAll()).resolves.toEqual([transcript()])
  })

  it('updates existing resources by id', async () => {
    await repository.save(transcript())
    await repository.save(transcript({ title: 'Updated title', summary: 'Useful suspension overview.' }))

    await expect(repository.getById('resource-1')).resolves.toMatchObject({
      title: 'Updated title',
      summary: 'Useful suspension overview.'
    })
  })

  it('searches across text fields and gets resources by type', async () => {
    await repository.save(transcript())
    await repository.save(
      transcript({
        id: 'resource-2',
        type: 'article',
        source: 'web',
        title: 'Welding reference',
        content: 'MIG welding settings for thin material.',
        tags: ['fabrication']
      })
    )

    await expect(repository.search('welding')).resolves.toHaveLength(1)
    await expect(repository.getByType('transcript')).resolves.toEqual([transcript()])
  })

  it('deletes resources', async () => {
    await repository.save(transcript())
    await repository.delete('resource-1')

    await expect(repository.getById('resource-1')).resolves.toBeNull()
  })
})
