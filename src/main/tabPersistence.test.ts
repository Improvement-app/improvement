import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TAB_STATE_FILE_NAME,
  createPersistedTabState,
  getTabStateFilePath,
  parsePersistedTabState,
  readPersistedTabState,
  writePersistedTabState
} from './tabPersistence'

const tempDirs: string[] = []

async function createTempUserDataDir(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'improvement-tabs-'))
  tempDirs.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('tab persistence', () => {
  it('creates a persisted tab state with order and active tab preserved', () => {
    const state = createPersistedTabState(
      [
        { id: 'one', title: 'New Tab', url: 'improvement://new-tab' },
        { id: 'two', title: 'Vehicle Dynamics', url: 'https://example.com/vehicle-dynamics' }
      ],
      'two',
      new Date('2026-04-26T12:00:00.000Z')
    )

    expect(state).toEqual({
      version: 1,
      savedAt: '2026-04-26T12:00:00.000Z',
      tabs: [
        { title: 'New Tab', url: 'improvement://new-tab', isActive: false },
        { title: 'Vehicle Dynamics', url: 'https://example.com/vehicle-dynamics', isActive: true }
      ]
    })
  })

  it('marks the first tab active if saved data has no active tab', () => {
    const state = createPersistedTabState([{ id: 'one', title: '', url: 'https://example.com' }], null)

    expect(state.tabs).toEqual([{ title: 'New Tab', url: 'https://example.com', isActive: true }])
  })

  it('returns null for corrupted or incompatible tab state', () => {
    expect(parsePersistedTabState('not-json')).toBeNull()
    expect(parsePersistedTabState(JSON.stringify({ version: 999, tabs: [] }))).toBeNull()
    expect(parsePersistedTabState(JSON.stringify({ version: 1, tabs: [] }))).toBeNull()
  })

  it('writes and reads tab state from the user data folder', async () => {
    const userDataDir = await createTempUserDataDir()
    const state = createPersistedTabState([{ id: 'one', title: 'Docs', url: 'https://developer.mozilla.org/' }], 'one')

    await writePersistedTabState(userDataDir, state)

    expect(getTabStateFilePath(userDataDir)).toBe(join(userDataDir, TAB_STATE_FILE_NAME))
    expect(await readPersistedTabState(userDataDir)).toEqual(state)
    await expect(readFile(join(userDataDir, TAB_STATE_FILE_NAME), 'utf8')).resolves.toContain('developer.mozilla.org')
  })

  it('handles missing or corrupt persisted files gracefully', async () => {
    const userDataDir = await createTempUserDataDir()

    await expect(readPersistedTabState(userDataDir)).resolves.toBeNull()

    await writeFile(join(userDataDir, TAB_STATE_FILE_NAME), '{bad json')

    await expect(readPersistedTabState(userDataDir)).resolves.toBeNull()
  })
})
