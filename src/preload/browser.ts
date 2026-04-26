import { ipcRenderer } from 'electron'
import { ipcChannels } from '../shared/ipc'

const BUTTON_ID = 'improvement-send-to-ai-button'

function getSelectionText(): string {
  return window.getSelection()?.toString().trim() ?? ''
}

function removeButton(): void {
  document.getElementById(BUTTON_ID)?.remove()
}

function showButton(): void {
  const selection = window.getSelection()
  const text = getSelectionText()

  if (!selection || selection.rangeCount === 0 || text.length === 0) {
    removeButton()
    return
  }

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  if (rect.width === 0 && rect.height === 0) {
    removeButton()
    return
  }

  let button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null

  if (!button) {
    button = document.createElement('button')
    button.id = BUTTON_ID
    button.type = 'button'
    button.textContent = 'Send to AI'
    button.style.position = 'fixed'
    button.style.zIndex = '2147483647'
    button.style.padding = '7px 10px'
    button.style.border = '0'
    button.style.borderRadius = '999px'
    button.style.background = '#111827'
    button.style.color = '#ffffff'
    button.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.28)'
    button.style.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    button.style.cursor = 'pointer'
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => {
      const selectedText = getSelectionText()
      if (selectedText.length > 0) {
        ipcRenderer.send(ipcChannels.browserSelection, {
          text: selectedText,
          url: window.location.href,
          title: document.title
        })
      }
      removeButton()
    })
    document.documentElement.appendChild(button)
  }

  const top = Math.max(8, rect.top - 42)
  const left = Math.min(window.innerWidth - 120, Math.max(8, rect.left + rect.width / 2 - 48))

  button.style.top = `${top}px`
  button.style.left = `${left}px`
}

window.addEventListener('mouseup', () => window.setTimeout(showButton, 0))
window.addEventListener('keyup', () => window.setTimeout(showButton, 0))
window.addEventListener('scroll', removeButton, true)
window.addEventListener('mousedown', (event) => {
  if ((event.target as Element | null)?.id !== BUTTON_ID) {
    removeButton()
  }
})
