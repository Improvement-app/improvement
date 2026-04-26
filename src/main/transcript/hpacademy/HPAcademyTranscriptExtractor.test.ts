import { describe, expect, it } from 'vitest'
import { HPAcademyTranscriptExtractor } from './HPAcademyTranscriptExtractor'

describe('HPAcademyTranscriptExtractor', () => {
  const extractor = new HPAcademyTranscriptExtractor()

  it('detects HPAcademy video-like URLs', () => {
    expect(extractor.canHandle('https://www.hpacademy.com/courses/efi-tuning/lessons/fuel-tables')).toBe(true)
    expect(extractor.canHandle('https://members.hpacademy.com/courses/efi-tuning/lessons/fuel-tables')).toBe(true)
    expect(extractor.canHandle('https://members.hpacademy.com/webinars/example-webinar')).toBe(true)
  })

  it('rejects unrelated URLs', () => {
    expect(extractor.canHandle('https://www.hpacademy.com/')).toBe(false)
    expect(extractor.canHandle('https://example.com/courses/efi-tuning')).toBe(false)
    expect(extractor.canHandle('not a url')).toBe(false)
  })

  it('creates an extraction script for visible transcript windows', () => {
    const script = Reflect.get(extractor, 'createExtractionScript').call(extractor) as string

    expect(script).toContain('No HPAcademy transcript was found')
    expect(script).toContain('[class*="transcript" i]')
    expect(script).toContain('window.location.href')
  })
})
