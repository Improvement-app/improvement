import type { CapturedResource } from './resources'
import type { Project, ProjectInput, ProjectResourceLink, ProjectUpdate } from './projects'

export type TabId = string

export interface BrowserBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface BrowserTab {
  id: TabId
  title: string
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface TabsSnapshot {
  tabs: BrowserTab[]
  activeTabId: TabId | null
}

export interface CapturedSelection {
  text: string
  url: string
  title: string
}

export type TranscriptCaptureEvent =
  | {
      type: 'captured'
      capture: CapturedSelection
      capturedAt: string
      resource?: CapturedResource
    }
  | {
      type: 'unavailable'
      title: string
      url: string
      reason: string
      capturedAt: string
    }

export type MentorMessageRole = 'user' | 'assistant' | 'system'

export interface MentorMessage {
  id: string
  role: MentorMessageRole
  content: string
  source?: {
    title: string
    url: string
  }
  status?: 'streaming' | 'complete' | 'error'
}

export interface XaiStatus {
  hasApiKey: boolean
  source: 'environment' | 'temporary' | 'missing'
  model: string
}

export interface RagResourceReference {
  id: string
  title: string
  type: string
  source: string
  url?: string
}

export type MentorStreamEvent =
  | { type: 'started'; message: MentorMessage }
  | { type: 'delta'; id: string; delta: string }
  | { type: 'done'; id: string }
  | { type: 'error'; id?: string; error: string }
  | { type: 'context'; status: 'searching' | 'ready'; resources: RagResourceReference[] }

export interface RendererApi {
  createTab: (url?: string) => Promise<TabsSnapshot>
  closeTab: (tabId: TabId) => Promise<TabsSnapshot>
  switchTab: (tabId: TabId) => Promise<TabsSnapshot>
  navigateActiveTab: (url: string) => Promise<TabsSnapshot>
  goBack: () => Promise<TabsSnapshot>
  goForward: () => Promise<TabsSnapshot>
  reload: () => Promise<TabsSnapshot>
  setBrowserBounds: (bounds: BrowserBounds) => void
  getCapturedResources: () => Promise<CapturedResource[]>
  searchCapturedResources: (query: string) => Promise<CapturedResource[]>
  deleteCapturedResource: (id: string) => Promise<void>
  getProjects: () => Promise<Project[]>
  createProject: (project: ProjectInput) => Promise<Project>
  updateProject: (project: ProjectUpdate) => Promise<Project | null>
  deleteProject: (id: string) => Promise<void>
  linkResourceToProject: (resourceId: string, projectId: string) => Promise<ProjectResourceLink[]>
  unlinkResourceFromProject: (resourceId: string, projectId: string) => Promise<ProjectResourceLink[]>
  getResourceProjectLinks: (resourceId: string) => Promise<ProjectResourceLink[]>
  getProjectResources: (projectId: string) => Promise<CapturedResource[]>
  importPdfResource: () => Promise<CapturedResource | null>
  openPdfResource: (id: string) => Promise<TabsSnapshot>
  getXaiStatus: () => Promise<XaiStatus>
  setTemporaryXaiApiKey: (apiKey: string) => Promise<XaiStatus>
  captureTranscript: () => Promise<TranscriptCaptureEvent>
  sendCaptureToMentor: (capture: CapturedSelection) => Promise<void>
  sendMentorMessage: (message: string) => Promise<void>
  onTabsChanged: (callback: (snapshot: TabsSnapshot) => void) => () => void
  onSelectionCaptured: (callback: (selection: CapturedSelection) => void) => () => void
  onTranscriptCapture: (callback: (event: TranscriptCaptureEvent) => void) => () => void
  onMentorStream: (callback: (event: MentorStreamEvent) => void) => () => void
}

export const ipcChannels = {
  createTab: 'tabs:create',
  closeTab: 'tabs:close',
  switchTab: 'tabs:switch',
  navigateActiveTab: 'tabs:navigate-active',
  goBack: 'browser:go-back',
  goForward: 'browser:go-forward',
  reload: 'browser:reload',
  setBrowserBounds: 'browser:set-bounds',
  getCapturedResources: 'resources:get-all',
  searchCapturedResources: 'resources:search',
  deleteCapturedResource: 'resources:delete',
  getProjects: 'projects:get-all',
  createProject: 'projects:create',
  updateProject: 'projects:update',
  deleteProject: 'projects:delete',
  linkResourceToProject: 'projects:link-resource',
  unlinkResourceFromProject: 'projects:unlink-resource',
  getResourceProjectLinks: 'projects:get-resource-links',
  getProjectResources: 'projects:get-resources',
  importPdfResource: 'resources:import-pdf',
  openPdfResource: 'resources:open-pdf',
  tabsChanged: 'tabs:changed',
  selectionCaptured: 'selection:captured',
  browserSelection: 'browser:selection',
  getXaiStatus: 'xai:get-status',
  setTemporaryXaiApiKey: 'xai:set-temporary-api-key',
  captureTranscript: 'transcript:capture',
  sendCaptureToMentor: 'mentor:send-capture',
  sendMentorMessage: 'mentor:send-message',
  mentorStream: 'mentor:stream',
  transcriptCapture: 'transcript:captured'
} as const
