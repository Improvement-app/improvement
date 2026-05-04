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
        return value.replace(/\s+/g, ' ').trim()
      }

      function textFromSelector(selectors: string[]): string {
        for (const selector of selectors) {
          const text = normalizeText(document.querySelector(selector)?.textContent ?? '')

          if (text) {
            return text
          }
        }

        return ''
      }

      function cleanTitleFragment(value: string): string {
        return normalizeText(value)
          .replace(/^\d+\.\s*/, '')
          .replace(/^Section\s+\d+\s*[:.-]?\s*/i, '')
          .replace(/^Lecture\s+\d+\s*[:.-]?\s*/i, '')
          .replace(/\b(Preview|Start|Resume|Play|Current lecture)\b/gi, '')
          .replace(/\s+\d+\s*\/\s*\d+.*$/i, '')
          .replace(/\s+\d{1,2}:\d{2}(?::\d{2})?\s*$/i, '')
          .replace(/\s+\d+\s*(min|mins|hr|hrs)\s*$/i, '')
          .replace(/\s+[-|]\s+Udemy.*$/i, '')
          .replace(/\s+/g, ' ')
          .trim()
      }

      function lectureTitleFromElement(lectureElement: Element): string {
        const lectureTitle = textFromScopedSelector(lectureElement, [
          '[data-purpose="curriculum-item-title"]',
          '[data-purpose="item-title"]',
          '[data-purpose="lecture-title"]',
          '[data-purpose*="lecture-title" i]',
          '[data-purpose*="item-title" i]',
          '[class*="curriculum-item-link--curriculum-item-title" i]',
          '[class*="curriculum-item-view--title" i]',
          '[class*="lecture-title" i]',
          '[class*="item-title" i]',
          '[class*="title" i]',
          'h1',
          'h2',
          'h3',
          'span',
          'a',
          'button'
        ])

        return cleanTitleFragment(lectureTitle || lectureElement.textContent || '')
      }

      function textFromActiveLecture(selector: string): string {
        const activeLecture = document.querySelector(selector)

        return activeLecture ? lectureTitleFromElement(activeLecture) : ''
      }

      function textFromScopedSelector(root: Element, selectors: string[]): string {
        for (const selector of selectors) {
          const text = normalizeText(root.querySelector(selector)?.textContent ?? '')

          if (text) {
            return text
          }
        }

        return ''
      }

      function closestMatching(element: Element | null, selectors: string[]): Element | null {
        let current: Element | null = element

        while (current) {
          if (selectors.some((selector) => current?.matches(selector))) {
            return current
          }

          current = current.parentElement
        }

        return null
      }

      function getLectureId(): string {
        try {
          const parsed = new URL(window.location.href)
          const pathMatch = parsed.pathname.match(/\/lecture\/(\d+)/i)
          return pathMatch?.[1] || parsed.searchParams.get('lectureId') || parsed.searchParams.get('lecture_id') || ''
        } catch {
          return ''
        }
      }

      function findLectureElementById(lectureId: string): Element | null {
        if (!lectureId) {
          return null
        }

        const candidates = Array.from(
          document.querySelectorAll('[href], [data-id], [data-lecture-id], [data-purpose], [aria-label], [class]')
        )

        const matched = candidates.find((element) => {
          const attributes = [
            element.getAttribute('href'),
            element.getAttribute('data-id'),
            element.getAttribute('data-lecture-id'),
            element.getAttribute('data-purpose'),
            element.getAttribute('aria-label'),
            element.getAttribute('class')
          ]

          return attributes.some((attribute) => attribute?.includes(lectureId))
        })

        return closestMatching(matched ?? null, [
          '[data-purpose*="curriculum-item" i]',
          '[data-purpose*="lecture" i]',
          '[class*="curriculum-item" i]',
          '[class*="lecture" i]',
          '[role="listitem"]',
          'li'
        ]) || matched || null
      }

      function findCurrentLectureElement(): Element | null {
        const byId = findLectureElementById(getLectureId())

        if (byId) {
          return byId
        }

        return document.querySelector(
          [
            '[data-purpose*="curriculum-item" i][aria-current]',
            '[data-purpose*="curriculum-item" i][class*="current" i]',
            '[data-purpose*="curriculum-item" i][class*="active" i]',
            '[data-purpose*="curriculum-item" i][class*="selected" i]',
            '[class*="curriculum-item" i][aria-current]',
            '[class*="curriculum-item" i][class*="current" i]',
            '[class*="curriculum-item" i][class*="active" i]',
            '[class*="curriculum-item" i][class*="selected" i]',
            '[class*="lecture" i][aria-current]',
            '[class*="lecture" i][class*="current" i]',
            '[class*="lecture" i][class*="active" i]',
            '[class*="lecture" i][class*="selected" i]'
          ].join(',')
        )
      }

      function findNearestSectionTitle(element: Element | null): string {
        let current: Element | null = element?.parentElement ?? null

        for (let depth = 0; current && depth < 6; depth += 1) {
          const isSectionContainer = current.matches(
            [
              '[data-purpose*="section" i]',
              '[data-purpose*="chapter" i]',
              '[class*="section" i]',
              '[class*="chapter" i]',
              'details'
            ].join(',')
          )

          if (!isSectionContainer) {
            current = current.parentElement
            continue
          }

          const sectionTitle = textFromScopedSelector(current, [
            '[data-purpose="section-heading"]',
            '[data-purpose="section-title"]',
            '[data-purpose*="section-title" i]',
            '[data-purpose*="chapter-title" i]',
            '[class*="section--section-title" i]',
            '[class*="section-title" i]',
            '[class*="chapter-title" i]',
            '[class*="title" i]',
            'summary',
            'h2',
            'h3'
          ])

          if (sectionTitle) {
            return cleanTitleFragment(sectionTitle)
          }

          current = current.parentElement
        }

        return ''
      }

      function getCourseTitle(): string {
        return cleanTitleFragment(
          textFromSelector([
            'h1[data-purpose="course-title"]',
            '[data-purpose="course-header-title"]',
            'h1'
          ]) ||
            document.title.replace(/\s+[-|]\s+.*Udemy.*$/i, '') ||
            'Udemy course'
        )
      }

      function getLectureTitle(): string {
        const currentLecture = findCurrentLectureElement()

        if (currentLecture) {
          const title = lectureTitleFromElement(currentLecture)

          if (title) {
            return title
          }
        }

        const activeLectureSelectors = [
          '[data-purpose*="curriculum-item" i][aria-current]',
          '[data-purpose*="curriculum-item" i][aria-current="true"]',
          '[data-purpose*="curriculum-item" i][class*="current" i]',
          '[data-purpose*="curriculum-item" i][class*="active" i]',
          '[data-purpose*="curriculum-item" i][class*="selected" i]',
          '[class*="curriculum-item" i][aria-current]',
          '[class*="curriculum-item" i][aria-current="true"]',
          '[class*="curriculum-item" i][class*="current" i]',
          '[class*="curriculum-item" i][class*="active" i]',
          '[class*="curriculum-item" i][class*="selected" i]',
          '[class*="lecture" i][aria-current]',
          '[class*="lecture" i][aria-current="true"]',
          '[class*="lecture" i][class*="current" i]',
          '[class*="lecture" i][class*="active" i]'
        ]

        for (const selector of activeLectureSelectors) {
          const title = textFromActiveLecture(selector)

          if (title) {
            return title
          }
        }

        return cleanTitleFragment(
          textFromSelector([
            '[data-purpose="curriculum-item-title"]',
            '[data-purpose="item-title"]',
            '[data-purpose="lecture-title"]',
            '[data-purpose*="lecture-title" i]',
            '[data-purpose*="video-title" i]',
            '[data-purpose*="asset-title" i]',
            '[class*="curriculum-item-view--title" i]',
            '[class*="curriculum-item-link--curriculum-item-title" i]',
            '[class*="lecture-title" i]',
            '[class*="video-title" i]',
            '[class*="asset-title" i]'
          ])
        )
      }

      function getSectionTitle(): string {
        const activeLecture = findCurrentLectureElement()

        return cleanTitleFragment(
          findNearestSectionTitle(activeLecture) ||
            textFromSelector([
              '[data-purpose="section-heading"]',
              '[data-purpose="section-title"]',
              '[data-purpose*="section-title" i]',
              '[data-purpose*="chapter-title" i]',
              '[class*="section--section-title" i]',
              '[class*="section-title" i]',
              '[class*="chapter-title" i]'
            ])
        )
      }

      function getTitle(): string {
        const sectionTitle = getSectionTitle()
        const lectureTitle = getLectureTitle()
        const courseTitle = getCourseTitle()

        if (sectionTitle && lectureTitle && sectionTitle !== lectureTitle) {
          return sectionTitle + ' - ' + lectureTitle
        }

        return lectureTitle || sectionTitle || courseTitle
      }

      function isVisible(element: Element): boolean {
        const htmlElement = element as HTMLElement
        const style = window.getComputedStyle(htmlElement)
        const rect = htmlElement.getBoundingClientRect()

        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      }

      function cleanTranscriptLine(value: string): string {
        return normalizeText(value)
          .replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, '')
          .trim()
      }

      function isTranscriptLine(value: string): boolean {
        const line = cleanTranscriptLine(value)

        if (line.length < 2 || /^\d{1,2}:\d{2}(?::\d{2})?$/.test(line)) {
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
