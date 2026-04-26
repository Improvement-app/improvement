import { contextBridge, ipcRenderer } from 'electron'
import type { BrowserBounds, CapturedSelection, RendererApi, TabId, TabsSnapshot } from '../shared/ipc'
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
  onTabsChanged: (callback: (snapshot: TabsSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: TabsSnapshot) => callback(snapshot)
    ipcRenderer.on(ipcChannels.tabsChanged, listener)
    return () => ipcRenderer.removeListener(ipcChannels.tabsChanged, listener)
  },
  onSelectionCaptured: (callback: (selection: CapturedSelection) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, selection: CapturedSelection) => callback(selection)
    ipcRenderer.on(ipcChannels.selectionCaptured, listener)
    return () => ipcRenderer.removeListener(ipcChannels.selectionCaptured, listener)
  }
}

contextBridge.exposeInMainWorld('improvement', api)
