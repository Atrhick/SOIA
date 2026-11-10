import { describe, expect, it } from 'vitest'
import { LISTED_ZONES, TIME_ZONE_GROUPS, isValidTimeZone, zoneLabel, zoneOffset, zoneOptions } from './time-zones'

describe('time zones', () => {
  it('lists only valid zones, with no duplicates', () => {
    const all = TIME_ZONE_GROUPS.flatMap((g) => g.zones.map((z) => z.id))
    expect(new Set(all).size).toBe(all.length)
    for (const z of all) expect(isValidTimeZone(z)).toBe(true)
  })
  it('covers every world region', () => {
    expect(TIME_ZONE_GROUPS.map((g) => g.region)).toEqual(['Africa', 'Americas', 'Europe', 'Middle East', 'Asia', 'Oceania'])
    expect(LISTED_ZONES.has('Africa/Nairobi')).toBe(true)
  })
  it('adds a detected zone that is not listed, on top', () => {
    const g = zoneOptions('America/Port_of_Spain')
    expect(g[0]).toEqual({ region: 'Your time zone', zones: [{ id: 'America/Port_of_Spain', label: 'Port of Spain' }] })
    expect(zoneOptions('Africa/Nairobi')[0].region).toBe('Africa')
    expect(zoneOptions('Not/AZone')[0].region).toBe('Africa')
  })
  it('shows offsets and readable names', () => {
    expect(zoneOffset('Africa/Nairobi', new Date('2026-01-15T12:00:00Z'))).toBe('GMT+3')
    expect(zoneOffset('UTC', new Date('2026-01-15T12:00:00Z'))).toBe('GMT+0')
    expect(zoneOffset('America/Chicago', new Date('2026-07-15T12:00:00Z'))).toBe('GMT-5')
    expect(zoneLabel('Africa/Nairobi')).toContain('Nairobi')
  })
  it('rejects bad zones', () => {
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
  })
})
