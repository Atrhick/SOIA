import { describe, expect, it } from 'vitest'
import { followUpTarget, phoneForLink } from './follow-up-links'

const msg = { subject: 'Checking in', body: 'Hi Maria, any thoughts?' }

describe('follow-up links', () => {
  it('cleans phone numbers', () => {
    expect(phoneForLink('+1 (702) 555-0123')).toBe('+17025550123')
    expect(phoneForLink('702-555-0123')).toBe('7025550123')
    expect(phoneForLink('12')).toBe('')
    expect(phoneForLink(null)).toBe('')
  })

  it('opens the app the person was first contacted on', () => {
    expect(followUpTarget('TEXT', { phone: '+1 702 555 0123' }, msg, true)).toEqual({ href: 'sms:+17025550123?&body=Hi%20Maria%2C%20any%20thoughts%3F', app: 'MESSAGES' })
    expect(followUpTarget('TEXT', {}, msg, true)?.href).toBe('sms:?&body=Hi%20Maria%2C%20any%20thoughts%3F')
    expect(followUpTarget('WHATSAPP', {}, msg, false)?.href).toBe('https://wa.me/?text=Hi%20Maria%2C%20any%20thoughts%3F')
    expect(followUpTarget('EMAIL', { email: 'maria@x.org' }, msg, false)?.href).toBe('mailto:maria@x.org?subject=Checking%20in&body=Hi%20Maria%2C%20any%20thoughts%3F')
  })

  it('only copies when there is nothing to open', () => {
    expect(followUpTarget('TEXT', {}, msg, false)).toBeNull()
    expect(followUpTarget('DM', {}, msg, true)).toBeNull()
    expect(followUpTarget('DM', { email: 'a@b.co' }, msg, true)?.app).toBe('EMAIL')
    expect(followUpTarget('PARENT', { email: 'dana@x.org' }, msg, false)?.app).toBe('EMAIL')
  })
})
