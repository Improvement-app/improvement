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
  return `(${function captureYouTubeTranscript(): YouTubeTranscriptResult {
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

    const title = getTitle()
    const url = window.location.href

    try {
      const transcriptText = getTranscriptText()

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
