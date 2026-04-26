import { TranscriptExtractor, type TranscriptExtractionResult } from '../base/TranscriptExtractor'

export class YouTubeTranscriptExtractor extends TranscriptExtractor {
  readonly id = 'youtube'
  readonly label = 'YouTube'

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url)
      const hostname = parsed.hostname.replace(/^www\./, '')

      return (hostname === 'youtube.com' || hostname === 'm.youtube.com') && parsed.pathname === '/watch' && Boolean(parsed.searchParams.get('v'))
    } catch {
      return false
    }
  }

  protected createExtractionScript(): string {
    return `(${async function captureYouTubeTranscript(): Promise<TranscriptExtractionResult> {
      const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

      function getTitle(): string {
        return (
          document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() ||
          document.querySelector('h1.title yt-formatted-string')?.textContent?.trim() ||
          document.title.replace(/\\s+-\\s+YouTube$/, '').trim() ||
          'YouTube video'
        )
      }

      function normalizeText(value: string): string {
        return value.replace(/\\s+/g, ' ').trim()
      }

      function isVisible(element: Element): boolean {
        const htmlElement = element as HTMLElement
        const style = window.getComputedStyle(htmlElement)
        const rect = htmlElement.getBoundingClientRect()

        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }

      function findTranscriptContainers(): Element[] {
        const selectors = [
          'ytd-engagement-panel-section-list-renderer[target-id*="transcript"]',
          'ytd-transcript-renderer',
          'ytd-transcript-search-panel-renderer',
          'ytd-transcript-segment-list-renderer',
          'ytd-transcript-body-renderer',
          '#segments-container',
          '[target-id*="transcript"]',
          '[aria-label*="Transcript" i]'
        ]

        return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
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

        return !['Transcript', 'Search in video', 'No results found', 'Show transcript', 'Hide transcript'].includes(line)
      }

      function lineStartsWithTimestamp(value: string): boolean {
        return /^\\d{1,2}:\\d{2}(?::\\d{2})?(\\s+|$)/.test(normalizeText(value))
      }

      function textFromElements(elements: Element[]): string {
        const lines = elements.map((element) => cleanTranscriptLine(element.textContent ?? '')).filter(isTranscriptLine)

        return Array.from(new Set(lines)).join('\\n')
      }

      function textFromContainer(container: Element): string {
        const segmentSelectors = [
          'ytd-transcript-segment-renderer yt-formatted-string',
          'ytd-transcript-segment-renderer .segment-text',
          'ytd-transcript-segment-renderer',
          'ytd-transcript-segment-list-renderer yt-formatted-string',
          'yt-formatted-string.segment-text',
          '.segment-text',
          '[class*="segment-text"]',
          '[class*="transcript-segment"]',
          '[role="listitem"]'
        ]

        const segmentText = textFromElements(segmentSelectors.flatMap((selector) => Array.from(container.querySelectorAll(selector))))

        if (segmentText) {
          return segmentText
        }

        return Array.from(new Set((container.textContent ?? '').split('\\n').map(cleanTranscriptLine).filter(isTranscriptLine))).join('\\n')
      }

      function textFromVisiblePageText(): string {
        const pageText = document.body?.innerText ?? ''
        const rawLines = pageText.split('\\n').map(normalizeText).filter(Boolean)
        const transcriptIndex = rawLines.findIndex((line) => line === 'Transcript' || line.startsWith('Transcript '))
        const searchIndex = rawLines.findIndex((line) => line === 'Search in video')
        const startIndex = searchIndex >= 0 ? searchIndex + 1 : transcriptIndex >= 0 ? transcriptIndex + 1 : 0
        const candidateLines = rawLines.slice(startIndex)
        const lines: string[] = []

        for (let index = 0; index < candidateLines.length; index += 1) {
          const line = candidateLines[index]

          if (lineStartsWithTimestamp(line)) {
            const sameLineText = cleanTranscriptLine(line)

            if (isTranscriptLine(sameLineText)) {
              lines.push(sameLineText)
              continue
            }

            const nextLine = candidateLines[index + 1]

            if (nextLine && isTranscriptLine(nextLine)) {
              lines.push(cleanTranscriptLine(nextLine))
              index += 1
            }
          }

          if (lines.length > 0 && ['Comments', 'Description', 'Up next', 'For you'].includes(line)) {
            break
          }
        }

        return Array.from(new Set(lines)).join('\\n')
      }

      function getTranscriptText(): string {
        const segmentSelectors = [
          'ytd-engagement-panel-section-list-renderer[target-id*="transcript"] ytd-transcript-segment-renderer yt-formatted-string',
          'ytd-transcript-segment-renderer',
          'ytd-transcript-segment-renderer .segment-text',
          'ytd-transcript-segment-list-renderer yt-formatted-string',
          'yt-formatted-string.segment-text',
          '.segment-text',
          '[class*="segment-text"]',
          '[class*="transcript-segment"]'
        ]

        const directElements = segmentSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        const visibleDirectText = textFromElements(directElements.filter(isVisible))
        const directText = visibleDirectText || textFromElements(directElements)

        if (directText) {
          return directText
        }

        for (const container of findTranscriptContainers()) {
          const containerText = textFromContainer(container)

          if (containerText) {
            return containerText
          }
        }

        return textFromVisiblePageText()
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
            reason: "Please click 'Show transcript' on the YouTube page first, then try again."
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
          reason: error instanceof Error ? error.message : 'Unable to capture the YouTube transcript.'
        }
      }
    }})()`
  }
}
