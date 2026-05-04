import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNewTabScript } from './newTabPage'

describe('New Tab page script', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="search-form">
        <input id="search-input" />
      </form>
      <button id="import-pdf-btn" type="button">Import PDF</button>
    `
  })

  it('generates executable browser JavaScript', () => {
    expect(() => new Function(createNewTabScript())).not.toThrow()
    expect(createNewTabScript()).not.toContain(' as HTMLButtonElement')
  })

  it('uses the preload PDF import bridge from the New Tab import button', async () => {
    const importPdfResource = vi.fn().mockResolvedValue({ title: 'Vehicle Dynamics Notes' })
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    Object.defineProperty(window, 'improvement', {
      configurable: true,
      value: {
        importPdfResource
      }
    })

    new Function(createNewTabScript())()

    const button = document.getElementById('import-pdf-btn') as HTMLButtonElement
    button.click()

    await vi.waitFor(() => expect(importPdfResource).toHaveBeenCalledTimes(1))
    expect(button.textContent).toBe('Import PDF')
    expect(button.disabled).toBe(false)
    expect(log).toHaveBeenCalledWith('PDF imported and opened in new tab:', 'Vehicle Dynamics Notes')

    log.mockRestore()
  })
})
