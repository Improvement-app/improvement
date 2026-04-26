import { describe, expect, it } from 'vitest'
import { createHPAcademyTranscriptScript, isHPAcademyVideoUrl } from './hpAcademyTranscript'

describe('hpAcademyTranscript', () => {
  it('detects HPAcademy video-like URLs', () => {
    expect(isHPAcademyVideoUrl('https://www.hpacademy.com/courses/efi-tuning/lessons/fuel-tables')).toBe(true)
    expect(isHPAcademyVideoUrl('https://members.hpacademy.com/courses/efi-tuning/lessons/fuel-tables')).toBe(true)
    expect(isHPAcademyVideoUrl('https://members.hpacademy.com/webinars/example-webinar')).toBe(true)
  })

  it('rejects unrelated URLs', () => {
    expect(isHPAcademyVideoUrl('https://www.hpacademy.com/')).toBe(false)
    expect(isHPAcademyVideoUrl('https://example.com/courses/efi-tuning')).toBe(false)
    expect(isHPAcademyVideoUrl('not a url')).toBe(false)
  })

  it('creates an extraction script for visible transcript windows', () => {
    const script = createHPAcademyTranscriptScript()

    expect(script).toContain('No HPAcademy transcript was found')
    expect(script).toContain('[class*="transcript" i]')
    expect(script).toContain('window.location.href')
  })
})
