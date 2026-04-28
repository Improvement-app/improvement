import { describe, expect, it } from 'vitest'
import { UdemyTranscriptExtractor } from './UdemyTranscriptExtractor'

describe('UdemyTranscriptExtractor', () => {
  const extractor = new UdemyTranscriptExtractor()

  it('detects Udemy course and lecture URLs', () => {
    expect(extractor.canHandle('https://www.udemy.com/course/javascript/learn/lecture/123456')).toBe(true)
    expect(extractor.canHandle('https://www.udemy.com/course/example-course/')).toBe(true)
    expect(extractor.canHandle('https://members.udemy.com/course/advanced-react/lecture/98765')).toBe(true)
    expect(extractor.canHandle('https://www.udemy.com/watch/?v=abc123')).toBe(true)
  })

  it('rejects unrelated URLs', () => {
    expect(extractor.canHandle('https://www.youtube.com/watch?v=abc')).toBe(false)
    expect(extractor.canHandle('https://hpacademy.com/courses/efi')).toBe(false)
    expect(extractor.canHandle('https://example.com/udemy')).toBe(false)
    expect(extractor.canHandle('not a url')).toBe(false)
  })

  it('creates an extraction script for Udemy transcript panel', () => {
    const script = Reflect.get(extractor, 'createExtractionScript').call(extractor) as string

    expect(script).toContain('Please open the Transcript panel in the Udemy video player first')
    expect(script).toContain('[data-purpose*="transcript-panel" i]')
    expect(script).toContain('window.location.href')
    expect(script).toContain('Udemy course')
  })
})
