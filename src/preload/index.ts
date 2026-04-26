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
  getXaiStatus: () => ipcRenderer.invoke(ipcChannels.getXaiStatus),
  setTemporaryXaiApiKey: (apiKey: string) => ipcRenderer.invoke(ipcChannels.setTemporaryXaiApiKey, apiKey),
  captureYouTubeTranscript: () => ipcRenderer.invoke(ipcChannels.captureYouTubeTranscript),
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
