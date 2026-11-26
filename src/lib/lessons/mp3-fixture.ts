/** Test helper: builds tiny valid MP3 byte streams (MPEG-1 Layer III, 128 kbps, 44.1 kHz, silent frames). */
export const FRAME_BYTES = 417 // floor(144 * 128000 / 44100)
export const FRAME_SECONDS = 1152 / 44100

function frame(info = false): Uint8Array {
  const f = new Uint8Array(FRAME_BYTES)
  f.set([0xff, 0xfb, 0x90, 0x00])
  if (info) f.set([0x49, 0x6e, 0x66, 0x6f], 4 + 32) // "Info" after the stereo side info
  return f
}

export function makeMp3(frames: number, opts: { id3?: boolean; info?: boolean; id3v1?: boolean } = {}): Uint8Array {
  const parts: Uint8Array[] = []
  if (opts.id3) {
    const body = new Uint8Array(20).fill(0x41)
    parts.push(new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, body.length]), body)
  }
  if (opts.info) parts.push(frame(true))
  for (let i = 0; i < frames; i++) parts.push(frame())
  if (opts.id3v1) {
    const tag = new Uint8Array(128)
    tag.set([0x54, 0x41, 0x47])
    parts.push(tag)
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
