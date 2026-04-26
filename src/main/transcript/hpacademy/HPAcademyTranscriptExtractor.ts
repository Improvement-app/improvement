import { TranscriptExtractor, type TranscriptExtractionResult } from '../base/TranscriptExtractor'

export class HPAcademyTranscriptExtractor extends TranscriptExtractor {
  readonly id = 'hpacademy'
  readonly label = 'HPAcademy'

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url)
      const hostname = parsed.hostname.replace(/^www\./, '')

      if (hostname !== 'hpacademy.com' && hostname !== 'members.hpacademy.com') {
        return false
      }

      return /\/(courses?|lessons?|modules?|webinars?|learn|members?|videos?)\b/i.test(parsed.pathname)
    } catch {
      return false
    }
  }

  protected createExtractionScript(): string {
    return `(${async function captureHPAcademyTranscript(): Promise<TranscriptExtractionResult> {
      const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

      function normalizeText(value: string): string {
        return value.replace(/\\s+/g, ' ').trim()
      }

      function getTitle(): string {
        return (
          document.querySelector('h1')?.textContent?.trim() ||
          document.querySelector('[class*="lesson-title" i]')?.textContent?.trim() ||
          document.querySelector('[class*="video-title" i]')?.textContent?.trim() ||
          document.querySelector('[data-testid*="title" i]')?.textContent?.trim() ||
          document.title.replace(/\\s+[-|]\\s+.*HPAcademy.*$/i, '').trim() ||
          'HPAcademy video'
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

        return !['Transcript', 'Search', 'Search transcript', 'Resources', 'Notes', 'Downloads', 'Previous', 'Next', 'Mark complete'].includes(line)
      }

      function textFromElements(elements: Element[]): string {
        const lines = elements.map((element) => cleanTranscriptLine(element.textContent ?? '')).filter(isTranscriptLine)

        return Array.from(new Set(lines)).join('\\n')
      }

      function textFromContainer(container: Element): string {
        const lineSelectors = [
          '[data-testid*="transcript" i]',
          '[class*="transcript-line" i]',
          '[class*="transcript-item" i]',
          '[class*="caption" i]',
          '[class*="cue" i]',
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
          '[data-testid*="transcript" i]',
          '[class*="transcript" i]',
          '[id*="transcript" i]',
          '[aria-label*="transcript" i]',
          '[class*="captions" i]',
          '[id*="captions" i]',
          '[class*="subtitles" i]',
          '[id*="subtitles" i]'
        ]

        return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))).filter(isVisible)
      }

      function getTranscriptText(): string {
        const containers = findTranscriptContainers()
          .map((container) => ({
            container,
            text: textFromContainer(container)
          }))
          .filter(({ text }) => text.length > 0)
          .sort((a, b) => b.text.length - a.text.length)

        return containers[0]?.text ?? ''
      }

      const title = getTitle()
      const url = window.location.href

      try {
        let transcriptText = getTranscriptText()

        for (let attempt = 0; !transcriptText && attempt < 5; attempt += 1) {
          await sleep(400)
          transcriptText = getTranscriptText()
        }

        if (!transcriptText) {
          return {
            ok: false,
            title,
            url,
            reason: 'No HPAcademy transcript was found. Make sure the transcript window is visible, then try again.'
          }
        }

        return {
          ok: true,
          title,
          url,
          text: transcriptText
        }
      } catch (error) {
        return {
          ok: false,
          title,
          url,
          reason: error instanceof Error ? error.message : 'Unable to capture the HPAcademy transcript.'
        }
      }
    }})()`
  }
}
