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

export interface RendererApi {
  createTab: (url?: string) => Promise<TabsSnapshot>
  closeTab: (tabId: TabId) => Promise<TabsSnapshot>
  switchTab: (tabId: TabId) => Promise<TabsSnapshot>
  navigateActiveTab: (url: string) => Promise<TabsSnapshot>
  goBack: () => Promise<TabsSnapshot>
  goForward: () => Promise<TabsSnapshot>
  reload: () => Promise<TabsSnapshot>
  setBrowserBounds: (bounds: BrowserBounds) => void
  onTabsChanged: (callback: (snapshot: TabsSnapshot) => void) => () => void
  onSelectionCaptured: (callback: (selection: CapturedSelection) => void) => () => void
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
  tabsChanged: 'tabs:changed',
  selectionCaptured: 'selection:captured',
  browserSelection: 'browser:selection'
} as const
