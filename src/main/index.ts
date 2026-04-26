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
import {
  createPersistedTabState,
  readPersistedTabState,
  writePersistedTabState,
  type PersistedTabState
} from './tabPersistence'
import { createYouTubeTranscriptScript, isYouTubeWatchUrl, type YouTubeTranscriptResult } from './youtubeTranscript'

const NEW_TAB_URL = 'improvement://new-tab'
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
  lastTranscriptCaptureUrl: string | null
  transcriptCaptureTimer: NodeJS.Timeout | null
}

let mainWindow: ElectronBrowserWindow | null = null
let activeTabId: TabId | null = null
let lastBrowserBounds: BrowserBounds | null = null
let temporaryXaiApiKey: string | null = null
let mentorBusy = false
let isQuitting = false
let hasSavedTabsForQuit = false
const tabs = new Map<TabId, ManagedTab>()

interface XaiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const mentorConversation: XaiChatMessage[] = []

function normalizeUrl(input: string): string {
  const trimmed = input.trim()

  if (trimmed.length === 0) {
    return NEW_TAB_URL
  }

  if (trimmed === NEW_TAB_URL) {
    return NEW_TAB_URL
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed
  }

  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

function isNewTabUrl(url: string): boolean {
  return url === NEW_TAB_URL || url.startsWith('data:text/html')
}

function createNewTabHtml(): string {
  const resources = [
    ['YouTube Engineering', 'Videos, lectures, fabrication channels', 'https://www.youtube.com/results?search_query=engineering+fabrication+vehicle+dynamics'],
    ['HP Academy', 'Motorsport wiring, tuning, and fabrication', 'https://www.hpacademy.com/'],
    ['MIT OpenCourseWare', 'Engineering fundamentals and math refreshers', 'https://ocw.mit.edu/'],
    ['Engineering Toolbox', 'Reference data, formulas, and calculators', 'https://www.engineeringtoolbox.com/'],
    ['NASA Technical Reports', 'Aerospace and engineering research archive', 'https://ntrs.nasa.gov/'],
    ['McMaster-Carr', 'Materials, fasteners, and mechanical components', 'https://www.mcmaster.com/'],
    ['MDN Web Docs', 'Technical documentation patterns and reference', 'https://developer.mozilla.org/'],
    ['Wikipedia', 'Fast overview before deeper source work', 'https://www.wikipedia.org/']
  ]

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Tab</title>
    <style>
      :root {
        color: #172033;
        background: #f5f7fb;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: start center;
        padding: 8vh 32px 48px;
        background:
          radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 30rem),
          linear-gradient(180deg, #ffffff, #f5f7fb);
      }
      main { width: min(940px, 100%); }
      .kicker {
        margin: 0 0 10px;
        color: #2563eb;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        color: #111827;
        font-size: clamp(34px, 5vw, 58px);
        letter-spacing: -0.06em;
      }
      .subtitle {
        max-width: 680px;
        margin: 14px 0 28px;
        color: #667085;
        font-size: 16px;
        line-height: 1.6;
      }
      form {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        max-width: 760px;
        padding: 8px;
        border: 1px solid #d7deea;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 18px 50px rgba(39, 52, 78, 0.10);
      }
      input {
        width: 100%;
        min-width: 0;
        padding: 14px 16px;
        border: 0;
        outline: none;
        background: transparent;
        color: #172033;
        font: inherit;
      }
      button {
        border: 0;
        border-radius: 13px;
        padding: 0 18px;
        background: #1d4ed8;
        color: white;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      section {
        margin-top: 34px;
      }
      .section-title {
        margin: 0 0 14px;
        color: #344054;
        font-size: 13px;
        font-weight: 800;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 12px;
      }
      a {
        min-height: 112px;
        padding: 16px;
        border: 1px solid #e3e8f2;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.86);
        color: inherit;
        text-decoration: none;
        transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
      }
      a:hover {
        border-color: #bfdbfe;
        box-shadow: 0 16px 36px rgba(39, 52, 78, 0.10);
        transform: translateY(-1px);
      }
      strong {
        display: block;
        margin-bottom: 8px;
        color: #172033;
      }
      span {
        display: block;
        color: #667085;
        font-size: 13px;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="kicker">Improvement Browser</p>
      <h1>Start a focused learning session.</h1>
      <p class="subtitle">Search the web or jump into trusted technical resources for engineering theory, fabrication practice, and project research.</p>
      <form id="search-form">
        <input id="search-input" autofocus placeholder="Search technical topics, videos, formulas, or documentation..." />
        <button type="submit">Search</button>
      </form>
      <section>
        <p class="section-title">Technical learning resources</p>
        <div class="grid">
          ${resources
            .map(
              ([title, description, url]) =>
                `<a href="${url}"><strong>${title}</strong><span>${description}</span></a>`
            )
            .join('')}
        </div>
      </section>
    </main>
    <script>
      document.getElementById('search-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const query = document.getElementById('search-input').value.trim();
        if (query) {
          window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
        }
      });
    </script>
  </body>
</html>`
}

function resolveLoadUrl(url: string): string {
  if (url === NEW_TAB_URL) {
    return `data:text/html;charset=utf-8,${encodeURIComponent(createNewTabHtml())}`
  }

  return url
}

function tabFromWebContentsId(webContentsId: number): ManagedTab | undefined {
  return [...tabs.values()].find((tab) => tab.view.webContents.id === webContentsId)
}

function getTabSnapshot(tab: ManagedTab): BrowserTab {
  return {
    id: tab.id,
    title: tab.title || 'New Tab',
    url: isNewTabUrl(tab.url) ? NEW_TAB_URL : tab.url,
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

function getPersistableTabs(): ManagedTab[] {
  return [...tabs.values()]
}

function broadcastTabs(): TabsSnapshot {
  const snapshot = getSnapshot()
  mainWindow?.webContents.send(ipcChannels.tabsChanged, snapshot)
  return snapshot
}

function sendTranscriptCaptureEvent(result: YouTubeTranscriptResult): void {
  const capturedAt = new Date().toISOString()

  if (result.ok) {
    mainWindow?.webContents.send(ipcChannels.transcriptCapture, {
      type: 'captured',
      capturedAt,
      capture: {
        title: result.title,
        url: result.url,
        text: result.text
      }
    })
    return
  }

  mainWindow?.webContents.send(ipcChannels.transcriptCapture, {
    type: 'unavailable',
    capturedAt,
    title: result.title,
    url: result.url,
    reason: result.reason
  })
}

function scheduleYouTubeTranscriptCapture(tab: ManagedTab): void {
  if (!isYouTubeWatchUrl(tab.url) || tab.lastTranscriptCaptureUrl === tab.url) {
    return
  }

  if (tab.transcriptCaptureTimer) {
    clearTimeout(tab.transcriptCaptureTimer)
  }

  const captureUrl = tab.url
  tab.transcriptCaptureTimer = setTimeout(() => {
    tab.transcriptCaptureTimer = null

    if (tab.url !== captureUrl || tab.view.webContents.isDestroyed()) {
      return
    }

    tab.lastTranscriptCaptureUrl = captureUrl

    void tab.view.webContents
      .executeJavaScript(createYouTubeTranscriptScript(), true)
      .then((result: YouTubeTranscriptResult) => {
        sendTranscriptCaptureEvent(result)
      })
      .catch((error) => {
        sendTranscriptCaptureEvent({
          ok: false,
          title: tab.title || 'YouTube video',
          url: captureUrl,
          reason: error instanceof Error ? error.message : 'Unable to capture the YouTube transcript.'
        })
      })
  }, 3500)
}

async function saveCurrentTabs(): Promise<void> {
  const state = createPersistedTabState(
    getPersistableTabs().map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url
    })),
    activeTabId
  )

  await writePersistedTabState(app.getPath('userData'), state)
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
    const currentUrl = webContents.getURL()
    tab.url = isNewTabUrl(currentUrl) ? NEW_TAB_URL : currentUrl
    tab.title = isNewTabUrl(currentUrl) ? 'New Tab' : webContents.getTitle() || tab.title
    broadcastTabs()
    scheduleYouTubeTranscriptCapture(tab)
  })

  webContents.on('did-navigate', (_event: ElectronEvent, url: string) => {
    tab.url = isNewTabUrl(url) ? NEW_TAB_URL : url
    broadcastTabs()
    scheduleYouTubeTranscriptCapture(tab)
  })

  webContents.on('did-navigate-in-page', (_event: ElectronEvent, url: string) => {
    tab.url = isNewTabUrl(url) ? NEW_TAB_URL : url
    broadcastTabs()
    scheduleYouTubeTranscriptCapture(tab)
  })
}

function createTab(url = NEW_TAB_URL): TabsSnapshot {
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
    isLoading: false,
    lastTranscriptCaptureUrl: null,
    transcriptCaptureTimer: null
  }

  tabs.set(id, tab)
  attachTabEvents(tab)
  setActiveTab(id)
  view.webContents.loadURL(resolveLoadUrl(tab.url))

  return broadcastTabs()
}

function restoreTabs(state: PersistedTabState | null): void {
  const savedTabs = state?.tabs ?? []

  if (savedTabs.length === 0) {
    createTab()
    return
  }

  let activeRestoredTabId: TabId | null = null

  for (const savedTab of savedTabs) {
    const beforeTabIds = new Set(tabs.keys())
    createTab(savedTab.url)
    const createdTabId = [...tabs.keys()].find((tabId) => !beforeTabIds.has(tabId)) ?? null
    const createdTab = createdTabId ? tabs.get(createdTabId) : null

    if (createdTab) {
      createdTab.title = savedTab.title || 'New Tab'
    }

    if (savedTab.isActive) {
      activeRestoredTabId = createdTabId
    }
  }

  if (activeRestoredTabId) {
    setActiveTab(activeRestoredTabId)
  }

  broadcastTabs()
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

  if (tab.transcriptCaptureTimer) {
    clearTimeout(tab.transcriptCaptureTimer)
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
  tab.view.webContents.loadURL(resolveLoadUrl(tab.url))
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
  const isYouTubeTranscript = isYouTubeWatchUrl(capture.url) && capture.text.startsWith('YouTube transcript captured automatically.')

  if (isYouTubeTranscript) {
    return [
      'The learner watched a YouTube video and Improvement automatically captured the transcript.',
      '',
      `Video title: ${capture.title || 'Untitled YouTube video'}`,
      `URL: ${capture.url}`,
      '',
      'Transcript:',
      capture.text.replace(/^YouTube transcript captured automatically\.\n\n/, ''),
      '',
      'Summarize the video for a serious adult technical learner. Extract the key concepts, explain practical engineering or fabrication relevance when useful, identify assumptions or gaps, and suggest follow-up practice questions.'
    ].join('\n')
  }

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

  mainWindow.on('close', () => {
    if (!hasSavedTabsForQuit) {
      void saveCurrentTabs().catch((error) => {
        console.warn('Unable to save tab state before window close:', error)
      })
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', async () => {
    const restoredState = await readPersistedTabState(app.getPath('userData'))
    restoreTabs(restoredState)
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

  app.on('before-quit', (event) => {
    isQuitting = true

    if (hasSavedTabsForQuit) {
      return
    }

    event.preventDefault()

    void saveCurrentTabs()
      .catch((error) => {
        console.warn('Unable to save tab state before quit:', error)
      })
      .finally(() => {
        hasSavedTabsForQuit = true
        app.quit()
      })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit()
  }
})
