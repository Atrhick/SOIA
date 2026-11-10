import { describe, it, expect } from 'vitest'
import { addDaysYmd, checkRemindChoice, isTimeZone, recordingFor, remindInstant, ymdIn } from './orientation-rules'

const CT = 'America/Chicago'
// Monday 2026-11-09 08:00 Central (14:00 UTC)
const NOW = new Date('2026-11-09T14:00:00Z')

describe('recordingFor', () => {
  it('embeds YouTube links in their common shapes', () => {
    for (const u of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/embed/dQw4w9WgXcQ', 'https://m.youtube.com/shorts/dQw4w9WgXcQ']) {
      expect(recordingFor(u)).toEqual({ kind: 'embed', provider: 'YouTube', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0' })
    }
  })
  it('embeds Vimeo, keeping a private hash', () => {
    expect(recordingFor('https://vimeo.com/76979871')).toEqual({ kind: 'embed', provider: 'Vimeo', src: 'https://player.vimeo.com/video/76979871' })
    expect(recordingFor('https://vimeo.com/76979871/abc123def')).toMatchObject({ src: 'https://player.vimeo.com/video/76979871?h=abc123def' })
    expect(recordingFor('https://player.vimeo.com/video/76979871?h=abc123def')).toMatchObject({ src: 'https://player.vimeo.com/video/76979871?h=abc123def' })
  })
  it('embeds Loom share links', () => {
    expect(recordingFor('https://www.loom.com/share/0123456789abcdef0123456789abcdef')).toEqual({ kind: 'embed', provider: 'Loom', src: 'https://www.loom.com/embed/0123456789abcdef0123456789abcdef' })
  })
  it('links out for other https pages and rejects anything else', () => {
    expect(recordingFor('https://drive.google.com/file/d/xyz/view')).toEqual({ kind: 'link', href: 'https://drive.google.com/file/d/xyz/view' })
    expect(recordingFor('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(recordingFor('javascript:alert(1)')).toBeNull()
    expect(recordingFor('')).toBeNull()
    expect(recordingFor(null)).toBeNull()
    // A YouTube page with a bad id falls back to a plain link, never an embed of attacker text.
    expect(recordingFor('https://youtube.com/watch?v="><script>')).toMatchObject({ kind: 'link' })
  })
})

describe('remind me later', () => {
  it('knows real time zones', () => {
    expect(isTimeZone(CT)).toBe(true)
    expect(isTimeZone('Mars/Base')).toBe(false)
    expect(isTimeZone('')).toBe(false)
  })
  it('works in the prospect time zone', () => {
    expect(ymdIn(NOW, CT)).toBe('2026-11-09')
    expect(ymdIn(new Date('2026-11-10T03:00:00Z'), CT)).toBe('2026-11-09')
    expect(addDaysYmd(NOW, 2, CT)).toBe('2026-11-11')
    expect(remindInstant('2026-11-11', 'EVENING', CT)?.toISOString()).toBe('2026-11-12T01:00:00.000Z')
    expect(remindInstant('2026-02-30', 'MORNING', CT)).toBeNull()
    expect(remindInstant('11/11/2026', 'MORNING', CT)).toBeNull()
  })
  it('accepts today later on and days up to the limit', () => {
    expect(checkRemindChoice('2026-11-09', 'EVENING', CT, NOW)).toMatchObject({ ok: true })
    expect(checkRemindChoice('2026-11-23', 'MORNING', CT, NOW)).toMatchObject({ ok: true })
  })
  it('rejects past times, past days and days too far out', () => {
    expect(checkRemindChoice('2026-11-09', 'MORNING', CT, new Date('2026-11-09T15:00:00Z'))).toMatchObject({ ok: false, field: 'part' })
    expect(checkRemindChoice('2026-11-08', 'EVENING', CT, NOW)).toMatchObject({ ok: false, field: 'date' })
    expect(checkRemindChoice('2026-11-24', 'MORNING', CT, NOW)).toMatchObject({ ok: false, field: 'date' })
    expect(checkRemindChoice('2026-11-11', 'EVENING', 'Nowhere/Zone', NOW)).toMatchObject({ ok: false })
  })
})
