import { describe, expect, it } from 'vitest'
import { hostStatus, meetingLinkWarning } from './host-status'

describe('hostStatus', () => {
  const base = { active: true, ageRanges: ['A18_24'], blocks: 2, meetingUrl: 'https://zoom.us/j/1' }
  it('is bookable only with times, ages and active', () => {
    expect(hostStatus(base)).toBe('BOOKABLE')
    expect(hostStatus({ ...base, blocks: 0 })).toBe('NEEDS_TIMES')
    expect(hostStatus({ ...base, ageRanges: [] })).toBe('NEEDS_AGES')
    expect(hostStatus({ ...base, active: false, blocks: 0 })).toBe('PAUSED')
  })
})

describe('meetingLinkWarning', () => {
  it('accepts Zoom meeting and personal room links, and other providers', () => {
    expect(meetingLinkWarning('https://us06web.zoom.us/j/81286112668?pwd=abc')).toBeNull()
    expect(meetingLinkWarning('https://zoom.us/my/lina')).toBeNull()
    expect(meetingLinkWarning('https://meet.google.com/abc-defg-hij')).toBeNull()
  })
  it('flags a Zoom chat link', () => {
    expect(meetingLinkWarning('https://us05web.zoom.us/launch/chat?src=direct_chat_link&email=x@y.z')).toMatch(/chat link/)
  })
  it('flags other Zoom pages, empty and non-https', () => {
    expect(meetingLinkWarning('https://zoom.us/profile')).toMatch(/doesn.t look like a Zoom meeting/)
    expect(meetingLinkWarning('')).toMatch(/No meeting link/)
    expect(meetingLinkWarning('http://zoom.us/j/1')).toMatch(/https/)
    expect(meetingLinkWarning('not a url')).toMatch(/web address/)
  })
})
