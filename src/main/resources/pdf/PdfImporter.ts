import { randomUUID } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { CapturedResource } from '../../../shared/resources'

export function cleanPdfFilename(filePath: string): string {
  const extension = extname(filePath).toLowerCase() === '.pdf' ? '.pdf' : ''
  const name = basename(filePath, extname(filePath))
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `${name || 'imported-pdf'}${extension || '.pdf'}`
}

export async function importPdfResource(sourcePath: string, userDataPath: string): Promise<CapturedResource> {
  const pdfDirectory = join(userDataPath, 'pdfs')
  mkdirSync(pdfDirectory, { recursive: true })

  const cleanName = cleanPdfFilename(sourcePath)
  const destinationPath = join(pdfDirectory, `${Date.now()}-${randomUUID()}-${cleanName}`)

  copyFileSync(sourcePath, destinationPath)

  const fileBuffer = readFileSync(destinationPath)
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(fileBuffer) })

  try {
    const textResult = await parser.getText()
    const infoResult = await parser.getInfo().catch(() => null)
    const stats = statSync(destinationPath)
    const pdfInfo = infoResult?.info as { Title?: string; Author?: string; Subject?: string } | undefined
    const title = String(pdfInfo?.Title || basename(cleanName, '.pdf'))

    return {
      id: randomUUID(),
      type: 'pdf',
      source: 'file-upload',
      title,
      url: pathToFileURL(destinationPath).href,
      content: textResult.text.trim() || 'No extractable text was found in this PDF.',
      capturedAt: new Date().toISOString(),
      metadata: {
        filePath: destinationPath,
        originalFileName: basename(sourcePath),
        storedFileName: basename(destinationPath),
        pageCount: textResult.total,
        fileSizeBytes: stats.size,
        author: pdfInfo?.Author,
        subject: pdfInfo?.Subject
      },
      tags: ['pdf', 'file-upload']
    }
  } finally {
    await parser.destroy()
  }
}
