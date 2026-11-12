import { describe, expect, it } from 'vitest'
import { googleCalendarUrl, zoneLabel } from './calendar-link'

describe('googleCalendarUrl', () => {
  it('builds a TEMPLATE link with UTC dates', () => {
    const u = new URL(googleCalendarUrl({ title: 'Discovery call', startsAt: '2026-11-12T19:00:00.000Z', endsAt: '2026-11-12T19:30:00.000Z', details: 'Hi & bye' }))
    expect(u.origin + u.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(u.searchParams.get('action')).toBe('TEMPLATE')
    expect(u.searchParams.get('text')).toBe('Discovery call')
    expect(u.searchParams.get('dates')).toBe('20261112T190000Z/20261112T193000Z')
    expect(u.searchParams.get('details')).toBe('Hi & bye')
  })
})

describe('zoneLabel', () => {
  it('names the zone with its city', () => {
    expect(zoneLabel('America/Los_Angeles')).toMatch(/Los Angeles/)
  })
  it('falls back to the id for an unknown zone', () => {
    expect(zoneLabel('Not/A_Zone')).toBe('Not/A_Zone')
  })
})
