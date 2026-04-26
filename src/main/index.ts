import { app, BrowserWindow, ipcMain, WebContentsView } from 'electron'
import type { BrowserWindow as ElectronBrowserWindow, Event as ElectronEvent, WebContentsView as ElectronWebContentsView } from 'electron'
import { join } from 'node:path'
import type {
  BrowserBounds,
  BrowserTab,
  CapturedSelection,
  MentorMessage,
  MentorStreamEvent,
  TabId,
  TabsSnapshot,
  XaiStatus
} from '../shared/ipc'
import { ipcChannels } from '../shared/ipc'

const DEFAULT_HOME_URL = 'https://www.wikipedia.org'
const XAI_BASE_URL = 'https://api.x.ai/v1'
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4'
const MENTOR_SYSTEM_PROMPT = [
  'You are Improvement, an AI mentor for serious adult learners building deep technical mastery.',
  'The learner is often studying engineering theory, vehicle design, fabrication, CNC machining, welding, additive manufacturing, engines, or related hands-on trade skills.',
  'When source text is provided, explain it clearly, connect it to practical engineering or fabrication work when relevant, call out assumptions, and suggest useful next questions or exercises.',
  'Be direct, technically careful, and supportive. Avoid pretending to know source context that was not provided.'
].join(' ')

interface ManagedTab {
  id: TabId
  view: ElectronWebContentsView
  title: string
  url: string
  isLoading: boolean
}

let mainWindow: ElectronBrowserWindow | null = null
let activeTabId: TabId | null = null
let lastBrowserBounds: BrowserBounds | null = null
let temporaryXaiApiKey: string | null = null
let mentorBusy = false
const tabs = new Map<TabId, ManagedTab>()

interface XaiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const mentorConversation: XaiChatMessage[] = []

function normalizeUrl(input: string): string {
  const trimmed = input.trim()

  if (trimmed.length === 0) {
    return DEFAULT_HOME_URL
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed
  }

  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

function tabFromWebContentsId(webContentsId: number): ManagedTab | undefined {
  return [...tabs.values()].find((tab) => tab.view.webContents.id === webContentsId)
}

function getTabSnapshot(tab: ManagedTab): BrowserTab {
  return {
    id: tab.id,
    title: tab.title || 'New Tab',
    url: tab.url,
    isLoading: tab.isLoading,
    canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
    canGoForward: tab.view.webContents.navigationHistory.canGoForward()
  }
}

function getSnapshot(): TabsSnapshot {
  return {
    tabs: [...tabs.values()].map(getTabSnapshot),
    activeTabId
  }
}

function broadcastTabs(): TabsSnapshot {
  const snapshot = getSnapshot()
  mainWindow?.webContents.send(ipcChannels.tabsChanged, snapshot)
  return snapshot
}

function applyActiveViewBounds(): void {
  if (!mainWindow || !activeTabId || !lastBrowserBounds) {
    return
  }

  const activeTab = tabs.get(activeTabId)

  if (!activeTab) {
    return
  }

  activeTab.view.setBounds({
    x: Math.round(lastBrowserBounds.x),
    y: Math.round(lastBrowserBounds.y),
    width: Math.max(0, Math.round(lastBrowserBounds.width)),
    height: Math.max(0, Math.round(lastBrowserBounds.height))
  })
}

function setActiveTab(tabId: TabId): void {
  if (!mainWindow || activeTabId === tabId) {
    applyActiveViewBounds()
    return
  }

  if (activeTabId) {
    const current = tabs.get(activeTabId)
    if (current) {
      mainWindow.contentView.removeChildView(current.view)
    }
  }

  const next = tabs.get(tabId)

  if (!next) {
    return
  }

  activeTabId = tabId
  mainWindow.contentView.addChildView(next.view)
  applyActiveViewBounds()
  broadcastTabs()
}

function attachTabEvents(tab: ManagedTab): void {
  const { webContents } = tab.view

  webContents.setWindowOpenHandler(({ url }) => {
    createTab(url)
    return { action: 'deny' }
  })

  webContents.on('page-title-updated', (_event: ElectronEvent, title: string) => {
    tab.title = title
    broadcastTabs()
  })

  webContents.on('did-start-loading', () => {
    tab.isLoading = true
    broadcastTabs()
  })

  webContents.on('did-stop-loading', () => {
    tab.isLoading = false
    tab.url = webContents.getURL()
    tab.title = webContents.getTitle() || tab.title
    broadcastTabs()
  })

  webContents.on('did-navigate', (_event: ElectronEvent, url: string) => {
    tab.url = url
    broadcastTabs()
  })

  webContents.on('did-navigate-in-page', (_event: ElectronEvent, url: string) => {
    tab.url = url
    broadcastTabs()
  })
}

function createTab(url = DEFAULT_HOME_URL): TabsSnapshot {
  if (!mainWindow) {
    return getSnapshot()
  }

  const id = crypto.randomUUID()
  const view = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/browser.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const tab: ManagedTab = {
    id,
    view,
    title: 'New Tab',
    url: normalizeUrl(url),
    isLoading: false
  }

  tabs.set(id, tab)
  attachTabEvents(tab)
  setActiveTab(id)
  view.webContents.loadURL(tab.url)

  return broadcastTabs()
}

function closeTab(tabId: TabId): TabsSnapshot {
  if (!mainWindow) {
    return getSnapshot()
  }

  const tab = tabs.get(tabId)

  if (!tab) {
    return getSnapshot()
  }

  if (activeTabId === tabId) {
    mainWindow.contentView.removeChildView(tab.view)
  }

  tab.view.webContents.close()
  tabs.delete(tabId)

  if (activeTabId === tabId) {
    activeTabId = null
    const nextTab = [...tabs.keys()].at(-1)
    if (nextTab) {
      setActiveTab(nextTab)
      return getSnapshot()
    }
  }

  return broadcastTabs()
}

function navigateActiveTab(url: string): TabsSnapshot {
  if (!activeTabId) {
    return createTab(url)
  }

  const tab = tabs.get(activeTabId)

  if (!tab) {
    return getSnapshot()
  }

  tab.url = normalizeUrl(url)
  tab.view.webContents.loadURL(tab.url)
  return broadcastTabs()
}

function getXaiApiKey(): { apiKey: string | null; source: XaiStatus['source'] } {
  if (process.env.XAI_API_KEY) {
    return { apiKey: process.env.XAI_API_KEY, source: 'environment' }
  }

  if (temporaryXaiApiKey) {
    return { apiKey: temporaryXaiApiKey, source: 'temporary' }
  }

  return { apiKey: null, source: 'missing' }
}

function getXaiStatus(): XaiStatus {
  const { apiKey, source } = getXaiApiKey()

  return {
    hasApiKey: Boolean(apiKey),
    source,
    model: XAI_MODEL
  }
}

function sendMentorEvent(event: MentorStreamEvent): void {
  mainWindow?.webContents.send(ipcChannels.mentorStream, event)
}

function buildCapturePrompt(capture: CapturedSelection): string {
  return [
    'The learner selected this web content and clicked "Send to AI".',
    '',
    `Page title: ${capture.title || 'Untitled page'}`,
    `URL: ${capture.url}`,
    '',
    'Selected text:',
    capture.text,
    '',
    'Explain the selection in a way that helps the learner build durable understanding. If useful, connect it to engineering theory, design decisions, fabrication practice, or project planning.'
  ].join('\n')
}

function parseGrokError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'The xAI API key was rejected. Check XAI_API_KEY or enter a valid x.ai API key.'
  }

  if (body.trim().length > 0) {
    return `xAI request failed (${status}): ${body.slice(0, 500)}`
  }

  return `xAI request failed with HTTP ${status}.`
}

function rememberConversationMessage(message: XaiChatMessage): void {
  mentorConversation.push(message)

  if (mentorConversation.length > 16) {
    mentorConversation.splice(0, mentorConversation.length - 16)
  }
}

async function streamMentorResponse(userContent: string): Promise<void> {
  const { apiKey } = getXaiApiKey()

  if (!apiKey) {
    sendMentorEvent({
      type: 'error',
      error: 'Add an xAI API key before sending content to Grok. You can set XAI_API_KEY or enter a temporary key in the right sidebar.'
    })
    return
  }

  if (mentorBusy) {
    sendMentorEvent({
      type: 'error',
      error: 'Grok is still responding. Wait for the current response to finish before sending another message.'
    })
    return
  }

  mentorBusy = true
  rememberConversationMessage({ role: 'user', content: userContent })

  const assistantMessage: MentorMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    status: 'streaming'
  }

  sendMentorEvent({ type: 'started', message: assistantMessage })

  try {
    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        stream: true,
        temperature: 0.4,
        messages: [
          { role: 'system', content: MENTOR_SYSTEM_PROMPT },
          ...mentorConversation
        ]
      })
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(parseGrokError(response.status, body))
    }

    if (!response.body) {
      throw new Error('xAI returned an empty streaming response.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let assistantContent = ''
    let done = false

    while (!done) {
      const result = await reader.read()
      done = result.done
      buffer += decoder.decode(result.value, { stream: !done })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()

        if (!trimmed.startsWith('data:')) {
          continue
        }

        const payload = trimmed.slice(5).trim()

        if (payload === '[DONE]') {
          done = true
          break
        }

        const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
        const delta = parsed.choices?.[0]?.delta?.content

        if (delta) {
          assistantContent += delta
          sendMentorEvent({ type: 'delta', id: assistantMessage.id, delta })
        }
      }
    }

    rememberConversationMessage({ role: 'assistant', content: assistantContent })
    sendMentorEvent({ type: 'done', id: assistantMessage.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reach xAI.'
    sendMentorEvent({ type: 'error', id: assistantMessage.id, error: message })
  } finally {
    mentorBusy = false
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 720,
    title: 'Improvement',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', () => {
    createTab(DEFAULT_HOME_URL)
  })
}

app.whenReady().then(() => {
  ipcMain.handle(ipcChannels.createTab, (_event, url?: string) => createTab(url))
  ipcMain.handle(ipcChannels.closeTab, (_event, tabId: TabId) => closeTab(tabId))
  ipcMain.handle(ipcChannels.switchTab, (_event, tabId: TabId) => {
    setActiveTab(tabId)
    return getSnapshot()
  })
  ipcMain.handle(ipcChannels.navigateActiveTab, (_event, url: string) => navigateActiveTab(url))
  ipcMain.handle(ipcChannels.goBack, () => {
    const tab = activeTabId ? tabs.get(activeTabId) : null
    if (tab?.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack()
    }
    return getSnapshot()
  })
  ipcMain.handle(ipcChannels.goForward, () => {
    const tab = activeTabId ? tabs.get(activeTabId) : null
    if (tab?.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward()
    }
    return getSnapshot()
  })
  ipcMain.handle(ipcChannels.reload, () => {
    const tab = activeTabId ? tabs.get(activeTabId) : null
    tab?.view.webContents.reload()
    return getSnapshot()
  })
  ipcMain.handle(ipcChannels.getXaiStatus, () => getXaiStatus())
  ipcMain.handle(ipcChannels.setTemporaryXaiApiKey, (_event, apiKey: string) => {
    const trimmed = apiKey.trim()
    temporaryXaiApiKey = trimmed.length > 0 ? trimmed : null
    return getXaiStatus()
  })
  ipcMain.handle(ipcChannels.sendCaptureToMentor, async (_event, capture: CapturedSelection) => {
    await streamMentorResponse(buildCapturePrompt(capture))
  })
  ipcMain.handle(ipcChannels.sendMentorMessage, async (_event, message: string) => {
    const trimmed = message.trim()
    if (trimmed.length === 0) {
      return
    }

    await streamMentorResponse(trimmed)
  })
  ipcMain.on(ipcChannels.setBrowserBounds, (_event, bounds: BrowserBounds) => {
    lastBrowserBounds = bounds
    applyActiveViewBounds()
  })
  ipcMain.on(ipcChannels.browserSelection, (event, selection: CapturedSelection) => {
    const tab = tabFromWebContentsId(event.sender.id)
    mainWindow?.webContents.send(ipcChannels.selectionCaptured, {
      ...selection,
      url: selection.url || tab?.url || ''
    })
  })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
