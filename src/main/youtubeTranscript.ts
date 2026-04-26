export interface YouTubeTranscriptSuccess {
  ok: true
  title: string
  url: string
  text: string
}

export interface YouTubeTranscriptFailure {
  ok: false
  title: string
  url: string
  reason: string
}

export type YouTubeTranscriptResult = YouTubeTranscriptSuccess | YouTubeTranscriptFailure

export function isYouTubeWatchUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')

    return (hostname === 'youtube.com' || hostname === 'm.youtube.com') && parsed.pathname === '/watch' && Boolean(parsed.searchParams.get('v'))
  } catch {
    return false
  }
}

export function createYouTubeTranscriptScript(): string {
  return `(${async function captureYouTubeTranscript(): Promise<YouTubeTranscriptResult> {
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms))

    function getTitle(): string {
      return (
        document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() ||
        document.querySelector('h1.title yt-formatted-string')?.textContent?.trim() ||
        document.title.replace(/\\s+-\\s+YouTube$/, '').trim() ||
        'YouTube video'
      )
    }

    function getTranscriptText(): string {
      const segmentSelectors = [
        'ytd-transcript-segment-renderer',
        'yt-formatted-string.segment-text',
        '[class*="transcript-segment"]'
      ]

      const segments = segmentSelectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .map((element) => element.textContent?.replace(/\\s+/g, ' ').trim() ?? '')
        .filter(Boolean)

      return Array.from(new Set(segments)).join('\\n')
    }

    async function clickShowTranscript(): Promise<boolean> {
      const buttons = Array.from(document.querySelectorAll('button, yt-button-shape button, ytd-button-renderer button'))

      const transcriptButton = buttons.find((button) => {
        const text = button.textContent?.replace(/\\s+/g, ' ').trim().toLowerCase() ?? ''
        const label = button.getAttribute('aria-label')?.toLowerCase() ?? ''
        return text.includes('show transcript') || label.includes('show transcript') || text === 'transcript'
      }) as HTMLElement | undefined

      if (transcriptButton) {
        transcriptButton.click()
        return true
      }

      const expanders = Array.from(document.querySelectorAll('tp-yt-paper-button, button, yt-button-shape button')) as HTMLElement[]
      const moreButton = expanders.find((button) => {
        const text = button.textContent?.replace(/\\s+/g, ' ').trim().toLowerCase() ?? ''
        const label = button.getAttribute('aria-label')?.toLowerCase() ?? ''
        return text === 'more' || label.includes('more')
      })

      moreButton?.click()
      await sleep(900)

      const expandedButtons = Array.from(document.querySelectorAll('button, yt-button-shape button, ytd-button-renderer button')) as HTMLElement[]
      const expandedTranscriptButton = expandedButtons.find((button) => {
        const text = button.textContent?.replace(/\\s+/g, ' ').trim().toLowerCase() ?? ''
        const label = button.getAttribute('aria-label')?.toLowerCase() ?? ''
        return text.includes('show transcript') || label.includes('show transcript') || text === 'transcript'
      })

      if (expandedTranscriptButton) {
        expandedTranscriptButton.click()
        return true
      }

      return false
    }

    const title = getTitle()
    const url = window.location.href

    try {
      let transcriptText = getTranscriptText()

      if (!transcriptText) {
        await clickShowTranscript()
        for (let index = 0; index < 10; index += 1) {
          await sleep(700)
          transcriptText = getTranscriptText()
          if (transcriptText) {
            break
          }
        }
      }

      if (!transcriptText) {
        return {
          ok: false,
          title,
          url,
          reason: 'No transcript was found for this YouTube video, or YouTube did not expose the transcript panel.'
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
