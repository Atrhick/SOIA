import { describe, expect, it } from 'vitest'
import {
  JPEG_DATA_URL_PREFIX, MAX_PHOTO_BYTES, base64ByteLength, centerCropSquare, cleanWhy, initialsOf, isValidJpegDataUrl, jpegDataUrlPayload,
} from './photo-rules'

const b64Of = (bytes: number[]) => Buffer.from(bytes).toString('base64')
const jpeg = (size: number) => {
  const buf = Buffer.alloc(size, 0x41)
  buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff
  return JPEG_DATA_URL_PREFIX + buf.toString('base64')
}

describe('jpegDataUrlPayload', () => {
  it('accepts a small JPEG data URL', () => {
    expect(isValidJpegDataUrl(jpeg(2000))).toBe(true)
    expect(jpegDataUrlPayload(jpeg(30))).toBe(jpeg(30).slice(JPEG_DATA_URL_PREFIX.length))
  })
  it('accepts exactly the limit and rejects one byte over', () => {
    expect(isValidJpegDataUrl(jpeg(MAX_PHOTO_BYTES))).toBe(true)
    expect(isValidJpegDataUrl(jpeg(MAX_PHOTO_BYTES + 1))).toBe(false)
  })
  it('rejects other types, bad prefixes and non-JPEG bytes', () => {
    expect(isValidJpegDataUrl(null)).toBe(false)
    expect(isValidJpegDataUrl(123)).toBe(false)
    expect(isValidJpegDataUrl('data:image/png;base64,' + b64Of([0x89, 0x50, 0x4e, 0x47, 1, 2]))).toBe(false)
    expect(isValidJpegDataUrl('DATA:image/jpeg;base64,' + b64Of([0xff, 0xd8, 0xff, 0, 0, 0]))).toBe(false)
    expect(isValidJpegDataUrl(JPEG_DATA_URL_PREFIX + b64Of([0x3c, 0x73, 0x76, 0x67, 0x3e, 0x20]))).toBe(false) // "<svg> "
    expect(isValidJpegDataUrl(JPEG_DATA_URL_PREFIX + '/9j/AAAA<script>')).toBe(false)
    expect(isValidJpegDataUrl(JPEG_DATA_URL_PREFIX + '/9j/AAA')).toBe(false)
  })
})

describe('base64ByteLength', () => {
  it('matches Buffer decoding', () => {
    for (const n of [1, 2, 3, 4, 5, 100]) expect(base64ByteLength(Buffer.alloc(n).toString('base64'))).toBe(n)
  })
})

describe('centerCropSquare', () => {
  it('crops landscape and portrait from the centre', () => {
    expect(centerCropSquare(400, 300)).toEqual({ sx: 50, sy: 0, size: 300 })
    expect(centerCropSquare(300, 500)).toEqual({ sx: 0, sy: 100, size: 300 })
    expect(centerCropSquare(320, 320)).toEqual({ sx: 0, sy: 0, size: 320 })
  })
})

describe('cleanWhy / initialsOf', () => {
  it('makes one tidy line', () => {
    expect(cleanWhy('  I help\n\nparents   rest. ')).toBe('I help parents rest.')
    expect(cleanWhy('   ')).toBeNull()
    expect(cleanWhy(undefined)).toBeNull()
  })
  it('builds initials with a safe fallback', () => {
    expect(initialsOf('Maya Johnson')).toBe('MJ')
    expect(initialsOf('maya')).toBe('M')
    expect(initialsOf('')).toBe('?')
    expect(initialsOf(null)).toBe('?')
  })
})
