/** Checks for portfolio uploads: photo or PDF, max 10 MB, type checked by the file's first bytes. */
export const PORTFOLIO_MAX_BYTES = 10 * 1024 * 1024

export type PortfolioFileKind = { ext: 'jpg' | 'png' | 'webp' | 'pdf'; contentType: string }

const EXT_OK: Record<string, PortfolioFileKind['ext']> = {
  jpg: 'jpg', jpeg: 'jpg', png: 'png', webp: 'webp', pdf: 'pdf',
}

/** What the bytes really are, or null if not an allowed type. */
export function sniffPortfolioFile(buf: Uint8Array): PortfolioFileKind | null {
  const at = (i: number) => buf[i]
  const ascii = (start: number, s: string) => s.split('').every((c, i) => at(start + i) === c.charCodeAt(0))
  if (buf.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' }
  if (buf.length >= 8 && at(0) === 0x89 && ascii(1, 'PNG') && at(4) === 0x0d && at(5) === 0x0a) return { ext: 'png', contentType: 'image/png' }
  if (buf.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { ext: 'webp', contentType: 'image/webp' }
  if (buf.length >= 5 && ascii(0, '%PDF-')) return { ext: 'pdf', contentType: 'application/pdf' }
  return null
}

/** Returns the file kind, or a plain-English error. Name extension and content must agree. */
export function checkPortfolioFile(name: string, buf: Uint8Array): PortfolioFileKind | { error: string } {
  if (buf.length === 0) return { error: 'That file is empty. Please pick another one.' }
  if (buf.length > PORTFOLIO_MAX_BYTES) return { error: 'That file is bigger than 10 MB. Please pick a smaller one.' }
  const ext = EXT_OK[(name.split('.').pop() || '').toLowerCase()]
  if (!ext) return { error: 'Please upload a photo (JPG, PNG, WEBP) or a PDF.' }
  const kind = sniffPortfolioFile(buf)
  if (!kind || kind.ext !== ext) return { error: "That file doesn't look like a real photo or PDF. Please try another one." }
  return kind
}
