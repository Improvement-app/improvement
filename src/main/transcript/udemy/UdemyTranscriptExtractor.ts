import { TranscriptExtractor, type TranscriptExtractionResult } from '../base/TranscriptExtractor'

export class UdemyTranscriptExtractor extends TranscriptExtractor {
  readonly id = 'udemy'
  readonly label = 'Udemy'

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url)
      const hostname = parsed.hostname.replace(/^www\./, '')

      if (hostname !== 'udemy.com' && hostname !== 'members.udemy.com') {
        return false
      }

      return /\/(course|courses|learn|lecture|watch)/i.test(parsed.pathname)
    } catch {
      return false
    }
  }

  protected createExtractionScript(): string {
    return `(${async function captureUdemyTranscript(): Promise<TranscriptExtractionResult> {
      const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

      function normalizeText(value: string): string {
        return value.replace(/\\s+/g, ' ').trim()
      }

      function getTitle(): string {
        return (
          document.querySelector('h1[data-purpose="course-title"]')?.textContent?.trim() ||
          document.querySelector('h1')?.textContent?.trim() ||
          document.querySelector('[class*="title" i]')?.textContent?.trim() ||
          document.title.replace(/\\s+[-|]\\s+.*Udemy.*$/i, '').trim() ||
          'Udemy course'
        )
      }

      function isVisible(element: Element): boolean {
        const htmlElement = element as HTMLElement
        const style = window.getComputedStyle(htmlElement)
        const rect = htmlElement.getBoundingClientRect()

        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }

      function cleanTranscriptLine(value: string): string {
        return normalizeText(value)
          .replace(/^\\d{1,2}:\\d{2}(?::\\d{2})?\\s*/, '')
          .trim()
      }

      function isTranscriptLine(value: string): boolean {
        const line = cleanTranscriptLine(value)

        if (line.length < 2 || /^\\d{1,2}:\\d{2}(?::\\d{2})?$/.test(line)) {
          return false
        }

        return !['Transcript', 'Show transcript', 'Hide transcript', 'Search', 'No transcript available'].includes(line)
      }

      function textFromElements(elements: Element[]): string {
        const lines = elements.map((element) => cleanTranscriptLine(element.textContent ?? '')).filter(isTranscriptLine)

        return Array.from(new Set(lines)).join('\\n')
      }

      function textFromContainer(container: Element): string {
        const lineSelectors = [
          '[data-purpose*="transcript-line" i]',
          '[class*="transcript-line" i]',
          '[class*="transcript-item" i]',
          '[class*="cue" i]',
          'span[class*="text" i]',
          'div[class*="line" i]',
          '[role="listitem"]',
          'li',
          'p'
        ]
        const lineText = textFromElements(lineSelectors.flatMap((selector) => Array.from(container.querySelectorAll(selector))))

        if (lineText) {
          return lineText
        }

        return Array.from(new Set((container.textContent ?? '').split('\\n').map(cleanTranscriptLine).filter(isTranscriptLine))).join('\\n')
      }

      function findTranscriptContainers(): Element[] {
        const selectors = [
          '[data-purpose*="transcript-panel" i]',
          '[data-purpose*="transcript" i]',
          '.transcript-panel',
          '[class*="transcript-panel" i]',
          '[class*="transcript" i]:not([class*="button"])',
          '#transcript',
          '[aria-label*="Transcript" i]',
          '[id*="transcript" i]'
        ]

        const candidates = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        return candidates.filter(isVisible)
      }

      // Give Udemy a moment to render dynamic content
      await sleep(800)

      const containers = findTranscriptContainers()

      if (containers.length === 0) {
        return {
          ok: false,
          title: getTitle(),
          url: window.location.href,
          reason: 'Please open the Transcript panel in the Udemy video player first, then click Capture Transcript again.'
        }
      }

      const transcriptText = containers.map(textFromContainer).filter(Boolean).join('\\n\\n')

      if (!transcriptText || transcriptText.length < 10) {
        return {
          ok: false,
          title: getTitle(),
          url: window.location.href,
          reason: 'No readable transcript text found in the Udemy panel.'
        }
      }

      return {
        ok: true,
        title: getTitle(),
        url: window.location.href,
        text: transcriptText
      }
    }})()`
  }
}
