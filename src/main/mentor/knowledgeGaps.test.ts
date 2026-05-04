import { describe, expect, it } from 'vitest'
import type { Project } from '../../shared/projects'
import type { CapturedResource } from '../../shared/resources'
import { analyzeProjectKnowledgeGaps } from './knowledgeGaps'

const now = new Date('2026-05-04T12:00:00.000Z')

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Vehicle Dynamics Study',
    description: 'Understand roll center, load transfer, and tire grip for setup decisions.',
    type: 'course',
    status: 'active',
    createdAt: '2026-05-04T12:00:00.000Z',
    notes: '',
    ...overrides
  }
}

function resource(overrides: Partial<CapturedResource> = {}): CapturedResource {
  return {
    id: 'resource-1',
    type: 'pdf',
    source: 'file-upload',
    title: 'Roll Center Notes',
    content: 'Roll center migration affects lateral load transfer and chassis balance.',
    capturedAt: '2026-05-04T12:00:00.000Z',
    metadata: {},
    tags: ['vehicle-dynamics'],
    ...overrides
  }
}

describe('analyzeProjectKnowledgeGaps', () => {
  it('recommends linking a first source when a project has no resources', () => {
    const summary = analyzeProjectKnowledgeGaps({
      project: project({ description: '', notes: '' }),
      resources: [],
      now
    })

    expect(summary).toMatchObject({
      projectId: 'project-1',
      resourceCount: 0,
      gaps: [
        {
          title: 'Clarify the project outcome',
          severity: 2
        },
        {
          title: 'Link one strong source',
          severity: 3
        }
      ]
    })
  })

  it('detects project terms that are not covered by linked resources', () => {
    const summary = analyzeProjectKnowledgeGaps({
      project: project(),
      resources: [
        resource({
          title: 'Roll Center Notes',
          content: 'Roll center migration affects lateral load transfer and chassis balance.'
        })
      ],
      now
    })

    expect(summary.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Cover tire',
          recommendation: expect.stringContaining('tire')
        })
      ])
    )
  })

  it('recommends synthesis notes when resources exist but notes are sparse', () => {
    const summary = analyzeProjectKnowledgeGaps({
      project: project({ notes: '' }),
      resources: [resource()],
      now
    })

    expect(summary.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Capture a synthesis note',
          metadata: expect.objectContaining({
            resourceCount: 1
          })
        })
      ])
    )
  })

  it('detects repeated mentor questions as knowledge gaps', () => {
    const summary = analyzeProjectKnowledgeGaps({
      project: project({
        description: 'Understand vehicle setup tradeoffs.',
        notes: 'I have a working project note with enough context to avoid sparse-note gaps.'
      }),
      resources: [
        resource({
          title: 'Roll Center Notes',
          content: 'Roll center migration affects lateral load transfer and chassis balance.'
        })
      ],
      recentQuestions: [
        'How does torsional rigidity change chassis setup?',
        'Can you explain torsional rigidity in practical terms?',
        'What should I measure before changing spring rates?'
      ],
      now
    })

    expect(summary.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Repeated question about torsional',
          detectedBy: 'repeated-question',
          evidence: expect.arrayContaining([
            expect.objectContaining({
              type: 'mentor',
              detail: expect.stringContaining('torsional rigidity')
            })
          ]),
          metadata: expect.objectContaining({
            term: 'torsional',
            questionCount: 2,
            coveredByLinkedResource: false
          })
        })
      ])
    )
  })
})
