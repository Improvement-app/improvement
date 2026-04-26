import type { WebContents } from 'electron'
import type { TranscriptCaptureEvent } from '../../../shared/ipc'

export interface TranscriptExtractionSuccess {
  ok: true
  title: string
  url: string
  text: string
}

export interface TranscriptExtractionFailure {
  ok: false
  title: string
  url: string
  reason: string
}

export type TranscriptExtractionResult = TranscriptExtractionSuccess | TranscriptExtractionFailure

export interface TranscriptExtractorContext {
  webContents: WebContents
  fallbackTitle: string
  url: string
}

export abstract class TranscriptExtractor {
  abstract readonly id: string
  abstract readonly label: string
  protected readonly timeoutMs = 6000

  abstract canHandle(url: string): boolean
  protected abstract createExtractionScript(): string

  async extractTranscript(context: TranscriptExtractorContext): Promise<TranscriptExtractionResult> {
    this.log('Starting transcript capture', context.url)

    try {
      const result = await this.withTimeout(
        context.webContents.executeJavaScript(this.createExtractionScript(), true) as Promise<TranscriptExtractionResult>,
        this.timeoutMs
      )

      this.log(result.ok ? 'Transcript capture succeeded' : 'Transcript capture unavailable', context.url)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to capture the ${this.label} transcript.`
      this.log('Transcript capture failed', message)

      return {
        ok: false,
        title: context.fallbackTitle || `${this.label} video`,
        url: context.url,
        reason: message
      }
    }
  }

  /**
   * Converts provider-specific extraction output into the shared event shape
   * consumed by the renderer's right-side learning workspace.
   */
  createWorkspaceEvent(result: TranscriptExtractionResult): TranscriptCaptureEvent {
    const capturedAt = new Date().toISOString()

    if (result.ok) {
      return {
        type: 'captured',
        capturedAt,
        capture: {
          title: result.title,
          url: result.url,
          text: result.text
        }
      }
    }

    return {
      type: 'unavailable',
      capturedAt,
      title: result.title,
      url: result.url,
      reason: result.reason
    }
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: NodeJS.Timeout | null = null

    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            reject(new Error(`${this.label} transcript capture timed out.`))
          }, timeoutMs)
        })
      ])
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }

  protected log(message: string, detail?: string): void {
    console.info(`[Transcript:${this.id}] ${message}${detail ? ` - ${detail}` : ''}`)
  }
}
