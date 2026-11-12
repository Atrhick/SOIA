import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEMPLATES, PERSONAL_MARKER, TEMPLATE_KEYS, checksPass, descriptionFromHeadline, disclosureLine, joinMessage,
  renderTemplate, resolveTemplate, shareLinkFor, splitAtPersonalLine, templateChecks, type FillValues,
} from './outreach-templates'

const V: FillValues = {
  firstName: 'Sarah',
  personalLine: 'You mentioned wanting to give back more, so I thought of you.',
  program: 'Health & Stress Management',
  description: 'a small group for busy people who want simpler ways to handle stress',
  link: 'https://x.test/join/maya/health?via=text',
  seatsLeft: 3,
}

describe('outreach templates', () => {
  it('every default passes its own checks', () => {
    for (const k of TEMPLATE_KEYS) {
      const c = templateChecks(k, DEFAULT_TEMPLATES[k])
      expect(checksPass(c), `${k}: ${c.filter((x) => !x.ok).map((x) => x.label).join('; ')}`).toBe(true)
    }
  })

  it('renders the text message with a seat line', () => {
    expect(renderTemplate(DEFAULT_TEMPLATES.TEXT.body, 'TEXT', V)).toBe(
      "Hi Sarah!\nYou mentioned wanting to give back more, so I thought of you.\nI'm involved with Health & Stress Management, a small group for busy people who want simpler ways to handle stress. NowTransformed, a nonprofit, is sponsoring a few seats this month. Would you be open to hearing about it?",
    )
  })

  it('drops the seat sentence when there is no offer, and the empty personal line', () => {
    const r = renderTemplate(DEFAULT_TEMPLATES.TEXT.body, 'TEXT', { ...V, seatsLeft: null, personalLine: '' })
    expect(r).not.toMatch(/seat/i)
    expect(r).toBe("Hi Sarah!\nI'm involved with Health & Stress Management, a small group for busy people who want simpler ways to handle stress. Would you be open to hearing about it?")
    expect(renderTemplate(DEFAULT_TEMPLATES.POST.body, 'POST', { ...V, seatsLeft: 0 })).not.toMatch(/seat/i)
  })

  it('posts use the real number of seats and the link', () => {
    const r = renderTemplate(DEFAULT_TEMPLATES.POST.body, 'POST', { ...V, seatsLeft: 1 })
    expect(r).toContain('there is 1 sponsored seat this month')
    expect(r).toContain(V.link)
  })

  it('splits around the personal line and joins back with the disclosure', () => {
    const rendered = renderTemplate(DEFAULT_TEMPLATES.EMAIL.body, 'EMAIL', { ...V, personalLine: PERSONAL_MARKER })
    const parts = splitAtPersonalLine(rendered)
    expect(parts.hasSlot).toBe(true)
    expect(parts.before).toBe('Hi Sarah,')
    expect(parts.sepBefore).toBe('\n\n')
    const msg = joinMessage(parts, 'Hope the move went well.', disclosureLine('AMBASSADOR', false))
    expect(msg.startsWith('Hi Sarah,\n\nHope the move went well.\n\nI')).toBe(true)
    expect(msg.endsWith("I'm a NowTransformed ambassador and get credit if you join.")).toBe(true)
    // No personal line: no double gap.
    expect(joinMessage(parts, '', null)).toMatch(/^Hi Sarah,\n\nI'm involved/)
  })

  it('disclosure only when the program is not theirs', () => {
    expect(disclosureLine('COACH', true)).toBeNull()
    expect(disclosureLine('AMBASSADOR', true)).toBeNull()
    expect(disclosureLine('COACH', false)).toBe("I'm a NowTransformed coach and get credit if you join.")
    expect(disclosureLine('AMBASSADOR', false)).toBe("I'm a NowTransformed ambassador and get credit if you join.")
  })

  it('checks catch links, missing question, missing personal line, promises and length', () => {
    const fail = (key: Parameters<typeof templateChecks>[0], body: string, subject: string | null = null) =>
      templateChecks(key, { body, subject }).filter((c) => !c.ok).map((c) => c.id)
    expect(fail('TEXT', 'Hi {first name}! {personal line} Join here {link}?')).toContain('no-link')
    expect(fail('TEXT', 'Hi {first name}! {personal line} See www.example.com?')).toContain('no-link')
    expect(fail('TEXT', 'Hi {first name}! {personal line} Want in.')).toContain('question')
    expect(fail('DM', 'Hi {first name}! Want in?')).toContain('personal')
    expect(fail('TEXT', 'Hi {personal line} it is guaranteed to work?')).toContain('promises')
    expect(fail('TEXT', 'Hi {personal line} earn $500 a week?')).toContain('promises')
    expect(fail('TEXT', `{personal line} ${'word '.repeat(80)}?`)).toContain('words')
    expect(fail('EMAIL', 'Hi {personal line}?', '')).toContain('subject')
    expect(fail('TEXT', 'Hi {name} {personal line}?')).toContain('fill-ins')
    expect(fail('AFTER_YES', 'Great!')).toContain('link')
    expect(fail('POST', 'Come along: {link}')).toEqual([])
    expect(fail('NUDGE', 'Hi {first name}, here it is again: {link}')).toContain('no-link')
  })

  it('resolves role row, then ALL row, then the default; drafts are ignored', () => {
    const rows = [
      { key: 'TEXT', audience: 'ALL', subject: null, body: 'all', status: 'LIVE' },
      { key: 'TEXT', audience: 'COACH', subject: null, body: 'coach', status: 'LIVE' },
      { key: 'DM', audience: 'ALL', subject: null, body: 'draft', status: 'DRAFT' },
    ]
    expect(resolveTemplate(rows, 'TEXT', 'COACH').body).toBe('coach')
    expect(resolveTemplate(rows, 'TEXT', 'AMBASSADOR').body).toBe('all')
    expect(resolveTemplate(rows, 'DM', 'COACH').source).toBe('DEFAULT')
  })

  it('links carry the channel in lower case', () => {
    expect(shareLinkFor('https://x.test/join/maya?via=old', 'WHATSAPP')).toBe('https://x.test/join/maya?via=whatsapp')
  })

  it('turns a headline into a description', () => {
    expect(descriptionFromHeadline('Simpler ways to handle stress.')).toBe('simpler ways to handle stress')
    expect(descriptionFromHeadline('NT groups for teens')).toBe('NT groups for teens')
    expect(descriptionFromHeadline('  ')).toBeNull()
  })
})
