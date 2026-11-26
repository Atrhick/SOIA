import { describe, it, expect } from 'vitest'
import { parseMp3, readFrameHeader } from './mp3'
import { FRAME_BYTES, FRAME_SECONDS, makeMp3 } from './mp3-fixture'

describe('readFrameHeader', () => {
  it('reads MPEG-1 Layer III 128 kbps 44.1 kHz', () => {
    const h = readFrameHeader(new Uint8Array([0xff, 0xfb, 0x90, 0x00]), 0)
    expect(h).toMatchObject({ length: 417, samples: 1152, sampleRate: 44100, layer: 3, mpeg1: true })
  })
  it('adds the padding byte and handles MPEG-2 (576 samples)', () => {
    expect(readFrameHeader(new Uint8Array([0xff, 0xfb, 0x92, 0x00]), 0)?.length).toBe(418)
    // MPEG-2 Layer III, 64 kbps (index 8), 24 kHz (index 1): 72 * 64000 / 24000 = 192
    const h = readFrameHeader(new Uint8Array([0xff, 0xf3, 0x84, 0x00]), 0)
    expect(h).toMatchObject({ length: 192, samples: 576, sampleRate: 24000, mpeg1: false })
  })
  it('rejects bad headers', () => {
    expect(readFrameHeader(new Uint8Array([0xff, 0xfb, 0xf0, 0x00]), 0)).toBeNull() // bitrate 15
    expect(readFrameHeader(new Uint8Array([0xff, 0xfb, 0x9c, 0x00]), 0)).toBeNull() // sample rate 3
    expect(readFrameHeader(new Uint8Array([0x00, 0xfb, 0x90, 0x00]), 0)).toBeNull()
  })
})

describe('parseMp3', () => {
  it('sums the real frame durations', () => {
    const r = parseMp3(makeMp3(100))!
    expect(r.frameCount).toBe(100)
    expect(r.durationSec).toBeCloseTo(100 * FRAME_SECONDS, 6)
    expect(r.audio.length).toBe(100 * FRAME_BYTES)
  })
  it('drops ID3v2, ID3v1 and the Xing/Info frame from the time and the audio', () => {
    const r = parseMp3(makeMp3(40, { id3: true, info: true, id3v1: true }))!
    expect(r.frameCount).toBe(40)
    expect(r.durationSec).toBeCloseTo(40 * FRAME_SECONDS, 6)
    expect(r.audio.length).toBe(40 * FRAME_BYTES)
    expect(r.audio[0]).toBe(0xff)
  })
  it('joined pieces add up exactly', () => {
    const a = parseMp3(makeMp3(10, { id3: true, info: true }))!
    const b = parseMp3(makeMp3(25, { info: true }))!
    const joined = new Uint8Array([...Array.from(a.audio), ...Array.from(b.audio)])
    expect(parseMp3(joined)!.durationSec).toBeCloseTo(a.durationSec + b.durationSec, 6)
  })
  it('skips junk before the first frame and ignores a cut-off last frame', () => {
    const good = makeMp3(5)
    const buf = new Uint8Array(3 + good.length + 100)
    buf.set([0x12, 0xff, 0x00])
    buf.set(good, 3)
    buf.set([0xff, 0xfb, 0x90, 0x00], 3 + good.length)
    const r = parseMp3(buf)!
    expect(r.frameCount).toBe(5)
  })
  it('returns null when there is no MPEG audio', () => {
    expect(parseMp3(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(parseMp3(new Uint8Array(0))).toBeNull()
  })
})
