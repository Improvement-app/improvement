export interface CapturedResource {
  id: string
  type: 'transcript' | 'pdf' | 'article' | 'textbook' | 'note' | string
  source: string
  title: string
  url?: string
  content: string
  capturedAt: string
  metadata: Record<string, any>
  tags?: string[]
  summary?: string
}

export type CapturedResourceInput = Omit<CapturedResource, 'id' | 'capturedAt'> & {
  id?: string
  capturedAt?: string
}

// To add a new resource type, emit a CapturedResourceInput with a unique
// type/source pair. The repository stores metadata as JSON, so provider-specific
// details can be added without changing the schema.
