/**
 * Invite profile rules shared by the browser (resize before upload) and the server (re-validate, serve).
 * Pure: no DOM, no Node APIs, so it runs in both places and in vitest.
 */

/** Photos are stored as small square JPEG data URLs on User.invitePhoto. */
export const PHOTO_SIZE = 320
export const PHOTO_QUALITY = 0.8
export const MAX_PHOTO_BYTES = 120 * 1024
export const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,'
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** "Why I do this": one line. */
export const WHY_MAX = 160

/** Largest base64 payload that can decode to MAX_PHOTO_BYTES (4 chars per 3 bytes, padded). */
const MAX_B64_CHARS = Math.ceil(MAX_PHOTO_BYTES / 3) * 4
const B64 = /^[A-Za-z0-9+/]+={0,2}$/

/** Decoded byte length of a base64 string (no decoding needed). */
export function base64ByteLength(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - pad
}

/**
 * The base64 payload of a JPEG data URL, or null if it is not one we accept:
 * exact `data:image/jpeg;base64,` prefix, clean base64, starts with the JPEG magic bytes (FF D8 FF,
 * which base64-encodes to "/9j/"), and decodes to at most MAX_PHOTO_BYTES.
 */
export function jpegDataUrlPayload(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(JPEG_DATA_URL_PREFIX)) return null
  const b64 = value.slice(JPEG_DATA_URL_PREFIX.length)
  if (b64.length < 8 || b64.length > MAX_B64_CHARS || b64.length % 4 !== 0) return null
  if (!B64.test(b64) || !b64.startsWith('/9j/')) return null
  if (base64ByteLength(b64) > MAX_PHOTO_BYTES) return null
  return b64
}

export const isValidJpegDataUrl = (value: unknown): value is string => jpegDataUrlPayload(value) !== null

/** Centre square crop of a w x h image: the source rectangle to draw. */
export function centerCropSquare(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.max(0, Math.min(width, height))
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size }
}

/** Tidy the "why" line: one line, single spaces, trimmed. Empty becomes null. */
export function cleanWhy(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = value.replace(/\s+/g, ' ').trim()
  return s ? s : null
}

/** Two initials for the photo placeholder, e.g. "Maya Johnson" -> "MJ". */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const first = (parts[0]?.[0] || '?').toUpperCase()
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '').toUpperCase() : ''
  return first + last
}
