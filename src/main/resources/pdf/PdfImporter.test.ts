import { describe, expect, it } from 'vitest'
import { cleanPdfFilename } from './PdfImporter'

describe('cleanPdfFilename', () => {
  it('creates safe filenames while preserving pdf extension', () => {
    expect(cleanPdfFilename('/Users/me/Downloads/Vehicle Dynamics: Chapter 1.pdf')).toBe('Vehicle-Dynamics-Chapter-1.pdf')
  })

  it('falls back when the filename has no safe characters', () => {
    expect(cleanPdfFilename('/tmp/!!!.pdf')).toBe('imported-pdf.pdf')
  })
})
