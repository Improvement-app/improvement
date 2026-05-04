import type { KnowledgeGapRecommendation, ProjectKnowledgeGapSummary } from '../../shared/knowledgeGaps'
import type { Project } from '../../shared/projects'
import type { CapturedResource } from '../../shared/resources'

const STOP_TERMS = new Set([
  'about',
  'above',
  'after',
  'again',
  'also',
  'build',
  'building',
  'course',
  'current',
  'details',
  'focus',
  'from',
  'general',
  'have',
  'into',
  'learn',
  'learning',
  'master',
  'mastery',
  'need',
  'notes',
  'project',
  'resource',
  'resources',
  'should',
  'skill',
  'study',
  'that',
  'this',
  'topic',
  'understand',
  'with',
  'work'
])

export function analyzeProjectKnowledgeGaps(input: {
  project: Project
  resources: CapturedResource[]
  availableResources?: CapturedResource[]
  sessionNotes?: string
  recentQuestions?: string[]
  now?: Date
}): ProjectKnowledgeGapSummary {
  const generatedAt = (input.now ?? new Date()).toISOString()
  const projectNotes = [input.project.notes, input.sessionNotes ?? ''].filter(Boolean).join('\n\n').trim()
  const projectText = [input.project.title, input.project.description, input.project.notes].filter(Boolean).join(' ')
  const resourceCorpus = buildResourceCorpus(input.resources)
  const availableResources = excludeLinkedResources(input.availableResources ?? [], input.resources)
  const coveredTopics = extractTerms(resourceCorpus.topicText, 8)
  const gaps: KnowledgeGapRecommendation[] = []

  const addGap = (
    gap: Pick<
      KnowledgeGapRecommendation,
      'id' | 'title' | 'description' | 'recommendation' | 'severity' | 'evidence' | 'metadata'
    >
      & Partial<Pick<KnowledgeGapRecommendation, 'detectedBy'>>
  ): void => {
    if (gaps.some((item) => item.id === gap.id)) {
      return
    }

    gaps.push({
      ...gap,
      projectId: input.project.id,
      status: 'open',
      detectedBy: gap.detectedBy ?? 'heuristic',
      createdAt: generatedAt,
      updatedAt: generatedAt
    })
  }

  if (input.project.description.trim().length < 32 && projectNotes.length < 48) {
    addGap({
      id: stableGapId(input.project.id, 'clarify-outcome'),
      title: 'Clarify the project outcome',
      description: 'The project has very little description or note context, so the mentor has a weak target for recommendations.',
      recommendation: 'Write a one-sentence outcome, a current constraint, and the next decision this project needs to support.',
      severity: 2,
      evidence: [
        {
          type: 'project',
          id: input.project.id,
          title: input.project.title,
          detail: 'Project description and notes are sparse.'
        }
      ],
      metadata: {
        descriptionLength: input.project.description.trim().length,
        noteLength: projectNotes.length
      }
    })
  }

  addRepeatedQuestionGaps({
    project: input.project,
    recentQuestions: input.recentQuestions ?? [],
    resourceCorpus,
    availableResources,
    addGap
  })

  if (input.resources.length === 0) {
    addGap({
      id: stableGapId(input.project.id, 'link-first-source'),
      title: 'Link one strong source',
      description: 'No captured resources are linked to this project yet.',
      recommendation: 'Import a PDF, capture a transcript, or attach an existing resource before asking for a roadmap.',
      severity: 3,
      evidence: [
        {
          type: 'project',
          id: input.project.id,
          title: input.project.title,
          detail: 'Project has zero linked resources.'
        }
      ],
      metadata: {
        resourceCount: 0
      }
    })

    return {
      projectId: input.project.id,
      projectTitle: input.project.title,
      generatedAt,
      resourceCount: 0,
      noteSignalCount: extractTerms(projectNotes, 12).length,
      coveredTopics,
      gaps
    }
  }

  if (projectNotes.length < 80) {
    addGap({
      id: stableGapId(input.project.id, 'synthesize-notes'),
      title: 'Capture a synthesis note',
      description: 'There are linked resources, but not enough notes to preserve what matters from them.',
      recommendation: 'Summarize the current takeaway, what is still unclear, and one practice step for this project.',
      severity: 2,
      evidence: input.resources.slice(0, 3).map((resource) => ({
        type: 'resource',
        id: resource.id,
        title: resource.title,
        detail: `Linked ${resource.type} resource.`
      })),
      metadata: {
        resourceCount: input.resources.length,
        noteLength: projectNotes.length
      }
    })
  }

  const resourceTypes = new Set(input.resources.map((resource) => resource.type))
  if (input.resources.length >= 2 && resourceTypes.size === 1) {
    const onlyType = [...resourceTypes][0] ?? 'resource'
    addGap({
      id: stableGapId(input.project.id, `balance-source-types-${onlyType}`),
      title: 'Balance the source mix',
      description: `All linked resources are ${onlyType} items, which can leave blind spots in examples, reference depth, or practice.`,
      recommendation: 'Add a different source type, such as a reference PDF, article, textbook section, or transcript from a worked example.',
      severity: 1,
      evidence: input.resources.slice(0, 3).map((resource) => ({
        type: 'resource',
        id: resource.id,
        title: resource.title,
        detail: `Current source type: ${resource.type}.`
      })),
      metadata: {
        sourceType: onlyType,
        resourceCount: input.resources.length
      }
    })
  }

  const projectTerms = extractTerms(projectText, 8)
  const missingProjectTerms = projectTerms
    .filter((term) => !resourceCorpus.searchText.includes(term))
    .slice(0, 3)

  for (const term of missingProjectTerms) {
    const recommendation = recommendAvailableResource(term, availableResources)
    addGap({
      id: stableGapId(input.project.id, `cover-${term}`),
      title: `Cover ${formatTerm(term)}`,
      description: `The project brief mentions ${formatTerm(term)}, but linked resources do not appear to cover it yet.`,
      recommendation: recommendation
        ? `Attach "${recommendation.title}" to this project, then ask Grok to explain how it covers ${formatTerm(term)}.`
        : `Find or capture one source that directly explains ${formatTerm(term)} and link it to this project.`,
      severity: 2,
      evidence: compactEvidence([
        {
          type: 'project',
          id: input.project.id,
          title: input.project.title,
          detail: `Project text includes "${formatTerm(term)}".`
        },
        recommendation
          ? {
              type: 'resource',
              id: recommendation.id,
              title: recommendation.title,
              detail: `Existing unlinked ${recommendation.type} resource appears to cover "${formatTerm(term)}".`
            }
          : null
      ]),
      metadata: {
        term,
        recommendedResourceId: recommendation?.id ?? null,
        recommendedResourceTitle: recommendation?.title ?? null
      }
    })
  }

  const noteTerms = extractTerms(projectNotes, 8)
  const uncoveredNoteTerms = noteTerms
    .filter((term) => !resourceCorpus.searchText.includes(term) && !normalizeText(projectText).includes(term))
    .slice(0, 2)

  for (const term of uncoveredNoteTerms) {
    const recommendation = recommendAvailableResource(term, availableResources)
    addGap({
      id: stableGapId(input.project.id, `source-note-${term}`),
      title: `Source the note on ${formatTerm(term)}`,
      description: `Your notes mention ${formatTerm(term)}, but no linked source currently backs it up.`,
      recommendation: recommendation
        ? `Attach "${recommendation.title}" as supporting evidence for the note about ${formatTerm(term)}.`
        : `Attach a resource that validates, expands, or challenges the note about ${formatTerm(term)}.`,
      severity: 1,
      evidence: compactEvidence([
        {
          type: 'notes',
          title: 'Project notes',
          detail: `Notes include "${formatTerm(term)}".`
        },
        recommendation
          ? {
              type: 'resource',
              id: recommendation.id,
              title: recommendation.title,
              detail: `Existing unlinked ${recommendation.type} resource appears to cover "${formatTerm(term)}".`
            }
          : null
      ]),
      metadata: {
        term,
        recommendedResourceId: recommendation?.id ?? null,
        recommendedResourceTitle: recommendation?.title ?? null
      }
    })
  }

  return {
    projectId: input.project.id,
    projectTitle: input.project.title,
    generatedAt,
    resourceCount: input.resources.length,
    noteSignalCount: noteTerms.length,
    coveredTopics,
    gaps: gaps.slice(0, 6)
  }
}

function addRepeatedQuestionGaps(input: {
  project: Project
  recentQuestions: string[]
  resourceCorpus: { searchText: string; topicText: string }
  availableResources: CapturedResource[]
  addGap: (
    gap: Pick<
      KnowledgeGapRecommendation,
      'id' | 'title' | 'description' | 'recommendation' | 'severity' | 'evidence' | 'metadata'
    >
      & Partial<Pick<KnowledgeGapRecommendation, 'detectedBy'>>
  ) => void
}): void {
  const meaningfulQuestions = input.recentQuestions.map((question) => question.trim()).filter((question) => question.length >= 12)

  if (meaningfulQuestions.length < 2) {
    return
  }

  const termQuestionCounts = new Map<string, { count: number; examples: string[] }>()

  for (const question of meaningfulQuestions) {
    for (const term of new Set(extractTerms(question, 8))) {
      const current = termQuestionCounts.get(term) ?? { count: 0, examples: [] }
      current.count += 1
      current.examples.push(question)
      termQuestionCounts.set(term, current)
    }
  }

  const repeatedTerms = [...termQuestionCounts.entries()]
    .filter(([_term, value]) => value.count >= 2)
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 2)

  for (const [term, value] of repeatedTerms) {
    const isCovered = input.resourceCorpus.searchText.includes(term)
    const recommendation = isCovered ? null : recommendAvailableResource(term, input.availableResources)
    input.addGap({
      id: stableGapId(input.project.id, `repeated-question-${term}`),
      title: `Repeated question about ${formatTerm(term)}`,
      description: `You have asked about ${formatTerm(term)} multiple times in this project, which suggests it needs a clearer explanation, practice, or source coverage.`,
      recommendation: isCovered
        ? `Ask Grok to synthesize the linked resources into a short explanation and practice check for ${formatTerm(term)}.`
        : recommendation
          ? `Attach "${recommendation.title}" to this project, then ask Grok to turn it into a short practice sequence for ${formatTerm(term)}.`
          : `Capture or link a focused source for ${formatTerm(term)}, then ask Grok to turn it into a short practice sequence.`,
      severity: isCovered ? 1 : 2,
      detectedBy: 'repeated-question',
      evidence: compactEvidence([
        ...value.examples.slice(0, 3).map((question) => ({
          type: 'mentor' as const,
          title: 'Recent mentor question',
          detail: question
        })),
        recommendation
          ? {
              type: 'resource' as const,
              id: recommendation.id,
              title: recommendation.title,
              detail: `Existing unlinked ${recommendation.type} resource appears to cover "${formatTerm(term)}".`
            }
          : null
      ]),
      metadata: {
        term,
        questionCount: value.count,
        coveredByLinkedResource: isCovered,
        recommendedResourceId: recommendation?.id ?? null,
        recommendedResourceTitle: recommendation?.title ?? null
      }
    })
  }
}

function excludeLinkedResources(availableResources: CapturedResource[], linkedResources: CapturedResource[]): CapturedResource[] {
  const linkedIds = new Set(linkedResources.map((resource) => resource.id))
  return availableResources.filter((resource) => !linkedIds.has(resource.id))
}

function recommendAvailableResource(term: string, availableResources: CapturedResource[]): CapturedResource | null {
  const normalizedTerm = normalizeText(term).trim()

  if (!normalizedTerm) {
    return null
  }

  return availableResources.find((resource) => resourceSearchText(resource).includes(normalizedTerm)) ?? null
}

function resourceSearchText(resource: CapturedResource): string {
  return normalizeText(
    [
      resource.title,
      resource.summary ?? '',
      resource.tags?.join(' ') ?? '',
      resource.content.slice(0, 4000)
    ].join(' ')
  )
}

function compactEvidence(
  evidence: Array<KnowledgeGapRecommendation['evidence'][number] | null>
): KnowledgeGapRecommendation['evidence'] {
  return evidence.filter((item): item is KnowledgeGapRecommendation['evidence'][number] => item !== null)
}

function buildResourceCorpus(resources: CapturedResource[]): { searchText: string; topicText: string } {
  const topicText = resources
    .map((resource) => [resource.title, resource.summary ?? '', resource.tags?.join(' ') ?? ''].join(' '))
    .join(' ')
  const searchText = resources
    .map((resource) =>
      [
        resource.title,
        resource.summary ?? '',
        resource.tags?.join(' ') ?? '',
        resource.content.slice(0, 6000)
      ].join(' ')
    )
    .join(' ')

  return {
    searchText: normalizeText(searchText),
    topicText
  }
}

function extractTerms(text: string, limit: number): string[] {
  const counts = new Map<string, { count: number; firstSeen: number }>()
  const words = normalizeText(text).match(/[\p{L}\p{N}_-]{4,}/gu) ?? []

  words.forEach((word, index) => {
    const term = word.replace(/^-+|-+$/g, '')

    if (term.length < 4 || STOP_TERMS.has(term)) {
      return
    }

    const current = counts.get(term)
    if (current) {
      current.count += 1
    } else {
      counts.set(term, { count: 1, firstSeen: index })
    }
  })

  return [...counts.entries()]
    .sort((left, right) => right[1].count - left[1].count || left[1].firstSeen - right[1].firstSeen)
    .map(([term]) => term)
    .slice(0, limit)
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, ' ')
}

function formatTerm(term: string): string {
  return term.replace(/-/g, ' ')
}

function stableGapId(projectId: string, suffix: string): string {
  return `${projectId}:${suffix.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}`
}
