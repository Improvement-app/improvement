import { describe, expect, it } from 'vitest'
import { getTranscriptExtractor, isSupportedTranscriptUrl } from './index'

describe('transcript registry', () => {
  it('returns the YouTube extractor for YouTube watch pages', () => {
    expect(getTranscriptExtractor('https://www.youtube.com/watch?v=abc123')?.id).toBe('youtube')
  })

  it('returns the HPAcademy extractor for HPAcademy video-like pages', () => {
    expect(getTranscriptExtractor('https://members.hpacademy.com/courses/efi-tuning/lessons/fuel-tables')?.id).toBe('hpacademy')
  })

  it('reports unsupported pages', () => {
    expect(getTranscriptExtractor('https://example.com/watch?v=abc123')).toBeNull()
    expect(isSupportedTranscriptUrl('https://example.com/watch?v=abc123')).toBe(false)
  })
})
