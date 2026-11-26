/**
 * Reads MP3 frame headers to get the exact playing time, and strips tags so several
 * MP3s can be joined into one clean stream. Pure, no dependencies.
 */

const BITRATES: Record<string, number[]> = {
  // kbps by index 0-14 (0 = free format, not supported)
  V1L1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  V1L2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  V1L3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  V2L1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  V2L23: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG 1
  2: [22050, 24000, 16000], // MPEG 2
  0: [11025, 12000, 8000], // MPEG 2.5
}

export interface Mp3FrameHeader {
  length: number
  samples: number
  sampleRate: number
  mpeg1: boolean
  layer: 1 | 2 | 3
  mono: boolean
}

/** The frame header at `o`, or null when there isn't a valid one. */
export function readFrameHeader(b: Uint8Array, o: number): Mp3FrameHeader | null {
  if (o + 4 > b.length) return null
  if (b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null
  const version = (b[o + 1] >> 3) & 3
  const layerBits = (b[o + 1] >> 1) & 3
  if (version === 1 || layerBits === 0) return null
  const layer = (4 - layerBits) as 1 | 2 | 3
  const brIdx = b[o + 2] >> 4
  const srIdx = (b[o + 2] >> 2) & 3
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null
  const pad = (b[o + 2] >> 1) & 1
  const mpeg1 = version === 3
  const table = mpeg1 ? (layer === 1 ? 'V1L1' : layer === 2 ? 'V1L2' : 'V1L3') : layer === 1 ? 'V2L1' : 'V2L23'
  const bitrate = BITRATES[table][brIdx] * 1000
  const sampleRate = SAMPLE_RATES[version][srIdx]
  let length: number
  let samples: number
  if (layer === 1) {
    length = (Math.floor((12 * bitrate) / sampleRate) + pad) * 4
    samples = 384
  } else if (layer === 2) {
    length = Math.floor((144 * bitrate) / sampleRate) + pad
    samples = 1152
  } else {
    length = Math.floor(((mpeg1 ? 144 : 72) * bitrate) / sampleRate) + pad
    samples = mpeg1 ? 1152 : 576
  }
  if (length < 4) return null
  return { length, samples, sampleRate, mpeg1, layer, mono: b[o + 3] >> 6 === 3 }
}

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...Array.from(b.subarray(o, o + n)))

/** A Xing/Info/VBRI frame describes the file and holds no sound. */
function isInfoFrame(b: Uint8Array, o: number, h: Mp3FrameHeader): boolean {
  if (h.layer !== 3) return false
  const side = h.mpeg1 ? (h.mono ? 17 : 32) : h.mono ? 9 : 17
  const tag = ascii(b, o + 4 + side, 4)
  return tag === 'Xing' || tag === 'Info' || ascii(b, o + 36, 4) === 'VBRI'
}

/** Byte offset where the audio starts, after any ID3v2 tags. */
function skipId3v2(b: Uint8Array): number {
  let o = 0
  while (o + 10 <= b.length && ascii(b, o, 3) === 'ID3') {
    const size = ((b[o + 6] & 0x7f) << 21) | ((b[o + 7] & 0x7f) << 14) | ((b[o + 8] & 0x7f) << 7) | (b[o + 9] & 0x7f)
    const footer = b[o + 5] & 0x10 ? 10 : 0
    o += 10 + size + footer
  }
  return o
}

export interface Mp3Info {
  /** Exact playing time in seconds (sum of every audio frame). */
  durationSec: number
  frameCount: number
  /** Only the audio frames: no ID3 tags, no Xing/Info frame. Safe to join with others. */
  audio: Uint8Array
}

/** Parses an MP3. Null when no MPEG audio frames are found. */
export function parseMp3(input: Uint8Array): Mp3Info | null {
  const b = input
  let end = b.length
  if (end >= 128 && ascii(b, end - 128, 3) === 'TAG') end -= 128
  let o = skipId3v2(b)
  const slices: Array<[number, number]> = []
  let seconds = 0
  let first = true
  while (o + 4 <= end) {
    const h = readFrameHeader(b, o)
    // Lock on only where the next frame also lines up (or the file ends), so stray 0xFF bytes don't count.
    const ok =
      h && o + h.length <= end && (!first || o + h.length === end || readFrameHeader(b, o + h.length) !== null)
    if (!h || !ok) {
      if (h && o + h.length > end && !first) break // cut-off last frame
      o++
      continue
    }
    if (!(first && isInfoFrame(b, o, h))) {
      slices.push([o, o + h.length])
      seconds += h.samples / h.sampleRate
    }
    first = false
    o += h.length
  }
  if (!slices.length) return null
  const total = slices.reduce((n, [s, e]) => n + e - s, 0)
  const audio = new Uint8Array(total)
  let w = 0
  for (const [s, e] of slices) {
    audio.set(b.subarray(s, e), w)
    w += e - s
  }
  return { durationSec: seconds, frameCount: slices.length, audio }
}
