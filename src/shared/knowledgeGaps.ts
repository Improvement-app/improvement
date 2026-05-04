export type KnowledgeGapStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'
export type KnowledgeGapSeverity = 0 | 1 | 2 | 3
export type KnowledgeGapDetectedBy = 'heuristic' | 'ai' | 'user' | 'quiz' | 'repeated-question'

export interface KnowledgeGapEvidence {
  type: 'project' | 'resource' | 'notes' | 'mentor'
  id?: string
  title: string
  detail: string
}

export interface KnowledgeGapRecommendation {
  id: string
  projectId: string
  title: string
  description: string
  recommendation: string
  status: KnowledgeGapStatus
  severity: KnowledgeGapSeverity
  detectedBy: KnowledgeGapDetectedBy
  evidence: KnowledgeGapEvidence[]
  createdAt: string
  updatedAt: string
  metadata: Record<string, string | number | boolean | null>
}

export interface ProjectKnowledgeGapSummary {
  projectId: string
  projectTitle: string
  generatedAt: string
  resourceCount: number
  noteSignalCount: number
  coveredTopics: string[]
  gaps: KnowledgeGapRecommendation[]
}
