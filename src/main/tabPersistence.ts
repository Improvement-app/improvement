import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const TAB_STATE_FILE_NAME = 'tabs.json'
export const TAB_STATE_VERSION = 1
export const MAX_RESTORED_TABS = 50

export interface PersistableTab {
  id: string
  title: string
  url: string
}

export interface PersistedTab {
  title: string
  url: string
  isActive: boolean
}

export interface PersistedTabState {
  version: typeof TAB_STATE_VERSION
  savedAt: string
  tabs: PersistedTab[]
}

function normalizePersistedTabs(tabs: PersistedTab[]): PersistedTab[] {
  const validTabs = tabs
    .filter((tab) => tab.url.trim().length > 0)
    .slice(0, MAX_RESTORED_TABS)
    .map((tab) => ({
      title: tab.title.trim() || 'New Tab',
      url: tab.url.trim(),
      isActive: tab.isActive
    }))

  if (validTabs.length > 0 && !validTabs.some((tab) => tab.isActive)) {
    validTabs[0] = { ...validTabs[0], isActive: true }
  }

  return validTabs
}

export function createPersistedTabState(
  tabs: PersistableTab[],
  activeTabId: string | null,
  savedAt = new Date()
): PersistedTabState {
  const persistedTabs = normalizePersistedTabs(
    tabs.map((tab) => ({
      title: tab.title,
      url: tab.url,
      isActive: tab.id === activeTabId
    }))
  )

  return {
    version: TAB_STATE_VERSION,
    savedAt: savedAt.toISOString(),
    tabs: persistedTabs
  }
}

export function parsePersistedTabState(raw: string): PersistedTabState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedTabState>

    if (parsed.version !== TAB_STATE_VERSION || !Array.isArray(parsed.tabs)) {
      return null
    }

    const tabs = normalizePersistedTabs(
      parsed.tabs.map((tab) => ({
        title: typeof tab.title === 'string' ? tab.title : 'New Tab',
        url: typeof tab.url === 'string' ? tab.url : '',
        isActive: Boolean(tab.isActive)
      }))
    )

    if (tabs.length === 0) {
      return null
    }

    return {
      version: TAB_STATE_VERSION,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date(0).toISOString(),
      tabs
    }
  } catch {
    return null
  }
}

export function getTabStateFilePath(userDataPath: string): string {
  return join(userDataPath, TAB_STATE_FILE_NAME)
}

export async function readPersistedTabState(userDataPath: string): Promise<PersistedTabState | null> {
  try {
    const raw = await readFile(getTabStateFilePath(userDataPath), 'utf8')
    return parsePersistedTabState(raw)
  } catch {
    return null
  }
}

export async function writePersistedTabState(userDataPath: string, state: PersistedTabState): Promise<void> {
  const filePath = getTabStateFilePath(userDataPath)
  const tempPath = `${filePath}.tmp`

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  await rename(tempPath, filePath)
}
