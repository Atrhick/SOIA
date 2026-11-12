import { describe, expect, it } from 'vitest'
import { biggestDrop, callsPer10, channelLabel, channelTakeaway, groupEncouragement, shortName, sortGroup, UNKNOWN_CHANNEL } from './outreach-stats'

describe('shortName', () => {
  it('first name and last initial', () => {
    expect(shortName('Andre', 'pierce')).toBe('Andre P.')
    expect(shortName('Andre', '')).toBe('Andre')
    expect(shortName(null, null)).toBe('Member')
  })
})

describe('channelLabel', () => {
  it('labels known, unknown and odd channels', () => {
    expect(channelLabel('TEXT')).toBe('Text')
    expect(channelLabel('POST')).toBe('Social post')
    expect(channelLabel(UNKNOWN_CHANNEL)).toBe('Unknown / before tracking')
    expect(channelLabel('FAX')).toBe('FAX')
  })
})

describe('biggestDrop', () => {
  it('finds the largest relative drop with enough people', () => {
    const d = biggestDrop([
      { label: 'message sent', value: 412 },
      { label: 'form filled', value: 96 },
      { label: 'call booked', value: 58 },
      { label: 'came to the call', value: 47 },
      { label: 'joined', value: 14 },
    ])
    expect(d).toEqual({ from: 'message sent', to: 'form filled', pct: 77 })
  })
  it('skips small and growing steps', () => {
    expect(biggestDrop([{ label: 'a', value: 2 }, { label: 'b', value: 0 }])).toBeNull()
    expect(biggestDrop([{ label: 'a', value: 5 }, { label: 'b', value: 9 }, { label: 'c', value: 3 }])).toEqual({ from: 'b', to: 'c', pct: 67 })
  })
})

describe('callsPer10', () => {
  it('rounds to one decimal and is null with nothing sent', () => {
    expect(callsPer10({ sent: 11, calls: 3 })).toBe(2.7)
    expect(callsPer10({ sent: 0, calls: 1 })).toBeNull()
  })
})

describe('channelTakeaway', () => {
  const row = (channel: string, sent: number, calls: number) => ({ channel, sent, forms: calls, calls, joined: 0 })
  it('needs 5 sent and a call in the best channel', () => {
    expect(channelTakeaway([row('TEXT', 4, 2)])).toBeNull()
    expect(channelTakeaway([row('TEXT', 8, 0)])).toBeNull()
  })
  it('names the best channel', () => {
    expect(channelTakeaway([row('TEXT', 11, 3), row('DM', 7, 1), row('EMAIL', 4, 0)])).toBe('Texts are working best for you this month.')
    expect(channelTakeaway([row('DM', 6, 1)])).toBe('DMs are bringing you calls this month.')
  })
})

describe('groupEncouragement', () => {
  const r = (name: string, callsBooked: number, me = false, streak = 0) => ({ name, callsBooked, me, streak })
  it('behind the leader', () => {
    expect(groupEncouragement(sortGroup([r('Andre P.', 5), r('You', 4, true), r('Grace O.', 3)]))).toBe('1 more booked call puts you level with Andre for first in your group.')
    expect(groupEncouragement([r('Andre P.', 5), r('You', 2, true)])).toBe('3 more booked calls puts you level with Andre for first in your group.')
  })
  it('leading, tied, or nobody yet', () => {
    expect(groupEncouragement([r('You', 3, true), r('Ann B.', 1)])).toMatch(/most booked calls/)
    expect(groupEncouragement([r('You', 3, true), r('Ann B.', 3)])).toMatch(/level for first/)
    expect(groupEncouragement([r('You', 0, true), r('Ann B.', 0)])).toMatch(/No calls booked/)
  })
})
