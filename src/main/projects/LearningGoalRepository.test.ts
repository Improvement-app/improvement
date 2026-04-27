import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProjectRepository } from './ProjectRepository'
import { LearningGoalRepository } from './LearningGoalRepository'

describe('LearningGoalRepository', () => {
  let userDataPath: string
  let projectRepository: ProjectRepository
  let learningGoalRepository: LearningGoalRepository
  let projectId: string

  beforeEach(async () => {
    userDataPath = mkdtempSync(join(tmpdir(), 'improvement-goals-'))
    projectRepository = new ProjectRepository(userDataPath)
    learningGoalRepository = new LearningGoalRepository(userDataPath)
    const project = await projectRepository.create({
      title: 'Engine Building Fundamentals',
      description: 'Course project',
      type: 'course',
      notes: ''
    })
    projectId = project.id
  })

  afterEach(() => {
    learningGoalRepository.close()
    projectRepository.close()
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('creates, updates, lists, deletes, and completes goals', async () => {
    const goal = await learningGoalRepository.create({
      projectId,
      title: 'Understand bearing clearance',
      description: 'Learn measurement technique and acceptable ranges.',
      priority: 5,
      notes: 'Use HPAcademy examples.'
    })

    await expect(learningGoalRepository.getById(goal.id)).resolves.toMatchObject({
      title: 'Understand bearing clearance',
      status: 'todo',
      priority: 5
    })
    await expect(learningGoalRepository.getByProjectId(projectId)).resolves.toHaveLength(1)

    await expect(learningGoalRepository.update({ id: goal.id, status: 'in-progress', priority: 4 })).resolves.toMatchObject({
      status: 'in-progress',
      priority: 4,
      completedAt: undefined
    })

    const completed = await learningGoalRepository.markComplete(goal.id)
    expect(completed).toMatchObject({ status: 'done' })
    expect(completed?.completedAt).toBeTruthy()

    await learningGoalRepository.delete(goal.id)
    await expect(learningGoalRepository.getById(goal.id)).resolves.toBeNull()
  })

  it('calculates project progress from completed goals', async () => {
    await learningGoalRepository.create({ projectId, title: 'Goal one', description: '', priority: 3, notes: '', status: 'done' })
    await learningGoalRepository.create({ projectId, title: 'Goal two', description: '', priority: 3, notes: '', status: 'done' })
    await learningGoalRepository.create({ projectId, title: 'Goal three', description: '', priority: 3, notes: '' })
    await learningGoalRepository.create({ projectId, title: 'Goal four', description: '', priority: 3, notes: '' })
    await learningGoalRepository.create({ projectId, title: 'Goal five', description: '', priority: 3, notes: '' })

    await expect(learningGoalRepository.getProjectProgress(projectId)).resolves.toEqual({
      projectId,
      totalGoals: 5,
      completedGoals: 2,
      percentComplete: 40
    })
  })
})
