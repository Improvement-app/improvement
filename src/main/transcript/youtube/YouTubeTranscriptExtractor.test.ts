import { describe, expect, it } from 'vitest'
import { YouTubeTranscriptExtractor } from './YouTubeTranscriptExtractor'

describe('YouTubeTranscriptExtractor', () => {
  const extractor = new YouTubeTranscriptExtractor()

  it('detects YouTube watch URLs', () => {
    expect(extractor.canHandle('https://www.youtube.com/watch?v=abc123')).toBe(true)
    expect(extractor.canHandle('https://youtube.com/watch?v=abc123&t=30s')).toBe(true)
    expect(extractor.canHandle('https://m.youtube.com/watch?v=abc123')).toBe(true)
  })

  it('rejects non-watch or non-YouTube URLs', () => {
    expect(extractor.canHandle('https://www.youtube.com/shorts/abc123')).toBe(false)
    expect(extractor.canHandle('https://www.youtube.com/watch')).toBe(false)
    expect(extractor.canHandle('https://example.com/watch?v=abc123')).toBe(false)
    expect(extractor.canHandle('not a url')).toBe(false)
  })

  it('creates an extraction script for transcript capture', () => {
    const script = Reflect.get(extractor, 'createExtractionScript').call(extractor) as string

    expect(script).toContain("Please click 'Show transcript'")
    expect(script).toContain('ytd-engagement-panel-section-list-renderer')
    expect(script).toContain('ytd-transcript-segment-renderer')
    expect(script).toContain('window.location.href')
  })
})
