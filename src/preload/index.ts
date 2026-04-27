import { contextBridge, ipcRenderer } from 'electron'
import type {
  BrowserBounds,
  CapturedSelection,
  MentorStreamEvent,
  RendererApi,
  TabId,
  TabsSnapshot,
  TranscriptCaptureEvent
} from '../shared/ipc'
import { ipcChannels } from '../shared/ipc'
import type { LearningGoalInput, LearningGoalUpdate, ProjectInput, ProjectUpdate } from '../shared/projects'

const api: RendererApi = {
  createTab: (url?: string) => ipcRenderer.invoke(ipcChannels.createTab, url),
  closeTab: (tabId: TabId) => ipcRenderer.invoke(ipcChannels.closeTab, tabId),
  switchTab: (tabId: TabId) => ipcRenderer.invoke(ipcChannels.switchTab, tabId),
  navigateActiveTab: (url: string) => ipcRenderer.invoke(ipcChannels.navigateActiveTab, url),
  goBack: () => ipcRenderer.invoke(ipcChannels.goBack),
  goForward: () => ipcRenderer.invoke(ipcChannels.goForward),
  reload: () => ipcRenderer.invoke(ipcChannels.reload),
  setBrowserBounds: (bounds: BrowserBounds) => {
    ipcRenderer.send(ipcChannels.setBrowserBounds, bounds)
  },
  getCapturedResources: () => ipcRenderer.invoke(ipcChannels.getCapturedResources),
  searchCapturedResources: (query: string) => ipcRenderer.invoke(ipcChannels.searchCapturedResources, query),
  deleteCapturedResource: (id: string) => ipcRenderer.invoke(ipcChannels.deleteCapturedResource, id),
  getProjects: () => ipcRenderer.invoke(ipcChannels.getProjects),
  createProject: (project: ProjectInput) => ipcRenderer.invoke(ipcChannels.createProject, project),
  updateProject: (project: ProjectUpdate) => ipcRenderer.invoke(ipcChannels.updateProject, project),
  deleteProject: (id: string) => ipcRenderer.invoke(ipcChannels.deleteProject, id),
  linkResourceToProject: (resourceId: string, projectId: string, learningGoalId?: string | null) =>
    ipcRenderer.invoke(ipcChannels.linkResourceToProject, resourceId, projectId, learningGoalId),
  unlinkResourceFromProject: (resourceId: string, projectId: string) =>
    ipcRenderer.invoke(ipcChannels.unlinkResourceFromProject, resourceId, projectId),
  getResourceProjectLinks: (resourceId: string) => ipcRenderer.invoke(ipcChannels.getResourceProjectLinks, resourceId),
  getProjectResources: (projectId: string) => ipcRenderer.invoke(ipcChannels.getProjectResources, projectId),
  getLearningGoals: (projectId: string) => ipcRenderer.invoke(ipcChannels.getLearningGoals, projectId),
  createLearningGoal: (goal: LearningGoalInput) => ipcRenderer.invoke(ipcChannels.createLearningGoal, goal),
  updateLearningGoal: (goal: LearningGoalUpdate) => ipcRenderer.invoke(ipcChannels.updateLearningGoal, goal),
  deleteLearningGoal: (id: string) => ipcRenderer.invoke(ipcChannels.deleteLearningGoal, id),
  markLearningGoalComplete: (id: string) => ipcRenderer.invoke(ipcChannels.markLearningGoalComplete, id),
  getProjectProgress: (projectId: string) => ipcRenderer.invoke(ipcChannels.getProjectProgress, projectId),
  importPdfResource: () => ipcRenderer.invoke(ipcChannels.importPdfResource),
  openPdfResource: (id: string) => ipcRenderer.invoke(ipcChannels.openPdfResource, id),
  getXaiStatus: () => ipcRenderer.invoke(ipcChannels.getXaiStatus),
  setTemporaryXaiApiKey: (apiKey: string) => ipcRenderer.invoke(ipcChannels.setTemporaryXaiApiKey, apiKey),
  captureTranscript: () => ipcRenderer.invoke(ipcChannels.captureTranscript),
  sendCaptureToMentor: (capture: CapturedSelection) => ipcRenderer.invoke(ipcChannels.sendCaptureToMentor, capture),
  sendMentorMessage: (message: string) => ipcRenderer.invoke(ipcChannels.sendMentorMessage, message),
  onTabsChanged: (callback: (snapshot: TabsSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: TabsSnapshot) => callback(snapshot)
    ipcRenderer.on(ipcChannels.tabsChanged, listener)
    return () => ipcRenderer.removeListener(ipcChannels.tabsChanged, listener)
  },
  onSelectionCaptured: (callback: (selection: CapturedSelection) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, selection: CapturedSelection) => callback(selection)
    ipcRenderer.on(ipcChannels.selectionCaptured, listener)
    return () => ipcRenderer.removeListener(ipcChannels.selectionCaptured, listener)
  },
  onTranscriptCapture: (callback: (event: TranscriptCaptureEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, transcriptEvent: TranscriptCaptureEvent) => callback(transcriptEvent)
    ipcRenderer.on(ipcChannels.transcriptCapture, listener)
    return () => ipcRenderer.removeListener(ipcChannels.transcriptCapture, listener)
  },
  onMentorStream: (callback: (event: MentorStreamEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, streamEvent: MentorStreamEvent) => callback(streamEvent)
    ipcRenderer.on(ipcChannels.mentorStream, listener)
    return () => ipcRenderer.removeListener(ipcChannels.mentorStream, listener)
  }
}

contextBridge.exposeInMainWorld('improvement', api)
