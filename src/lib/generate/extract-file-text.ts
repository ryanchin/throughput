import 'server-only'

/**
 * Extract plain text from a PDF or DOCX file buffer.
 * Server-side only — uses pdf-parse and mammoth.
 *
 * @throws Error if the file cannot be parsed
 */
export async function extractFileText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; wordCount: number }> {
  let text: string

  if (mimeType === 'application/pdf') {
    text = await extractPdfText(buffer)
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    text = await extractDocxText(buffer)
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length
  return { text, wordCount }
}

/** Extract text from a PDF buffer using pdf-parse. */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Import pdf-parse/lib/pdf-parse directly to avoid the index.js wrapper
  // which tries to load a test PDF file (./test/data/05-versions-space.pdf)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const result = await pdfParse(buffer)
  return result.text.trim()
}

/** Extract text from a DOCX buffer using mammoth. */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim()
}
