import { HPAcademyTranscriptExtractor } from './hpacademy/HPAcademyTranscriptExtractor'
import type { TranscriptExtractor } from './base/TranscriptExtractor'
import { YouTubeTranscriptExtractor } from './youtube/YouTubeTranscriptExtractor'
import { UdemyTranscriptExtractor } from './udemy/UdemyTranscriptExtractor'

const transcriptExtractors: TranscriptExtractor[] = [
  new YouTubeTranscriptExtractor(),
  new HPAcademyTranscriptExtractor(),
  new UdemyTranscriptExtractor()
]

export function getTranscriptExtractor(url: string): TranscriptExtractor | null {
  return transcriptExtractors.find((extractor) => extractor.canHandle(url)) ?? null
}

export function isSupportedTranscriptUrl(url: string): boolean {
  return Boolean(getTranscriptExtractor(url))
}

export { TranscriptExtractor } from './base/TranscriptExtractor'
export type { TranscriptExtractionResult } from './base/TranscriptExtractor'

// To add a new provider:
// 1. Create src/main/transcript/<provider>/<Provider>TranscriptExtractor.ts.
// 2. Extend TranscriptExtractor and implement canHandle() plus createExtractionScript().
// 3. Register an instance in transcriptExtractors above.
// 4. Add provider-specific tests for URL detection and script generation.
