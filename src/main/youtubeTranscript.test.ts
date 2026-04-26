import { describe, expect, it } from 'vitest'
import { createYouTubeTranscriptScript, isYouTubeWatchUrl } from './youtubeTranscript'

describe('youtubeTranscript', () => {
  it('detects YouTube watch URLs', () => {
    expect(isYouTubeWatchUrl('https://www.youtube.com/watch?v=abc123')).toBe(true)
    expect(isYouTubeWatchUrl('https://youtube.com/watch?v=abc123&t=30s')).toBe(true)
    expect(isYouTubeWatchUrl('https://m.youtube.com/watch?v=abc123')).toBe(true)
  })

  it('rejects non-watch or non-YouTube URLs', () => {
    expect(isYouTubeWatchUrl('https://www.youtube.com/shorts/abc123')).toBe(false)
    expect(isYouTubeWatchUrl('https://www.youtube.com/watch')).toBe(false)
    expect(isYouTubeWatchUrl('https://example.com/watch?v=abc123')).toBe(false)
    expect(isYouTubeWatchUrl('not a url')).toBe(false)
  })

  it('creates an extraction script for transcript capture', () => {
    const script = createYouTubeTranscriptScript()

    expect(script).toContain('show transcript')
    expect(script).toContain('ytd-transcript-segment-renderer')
    expect(script).toContain('window.location.href')
  })
})
