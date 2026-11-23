import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
import { PROGRAM_PAGE_EVENTS, NOTIFY_CATALOG, type NotifyContext, type ProgramPageNotifyEvent } from './notify'
import { MESSAGE_MAX, TITLE_MAX, programPageEmail, programPageText, reminderMessage, teamTag } from './emails'
import { coachPagePath, teamPagePath } from './paths'

const BASE = 'http://localhost:3001'

function ctx(event: ProgramPageNotifyEvent, over: Partial<NotifyContext> = {}): NotifyContext {
  const c: NotifyContext = {
    event,
    programId: 'pg1',
    rootId: 'root1',
    programName: 'Financial Empowerment',
    companyName: 'BrightPath Coaching',
    group: 'Families',
    ownerFirstName: 'Justin',
    ownerName: 'Justin Moyo',
    ownerRole: 'COACH',
    stage: 'READY_TO_CHECK',
    ownerPath: '',
    teamPath: teamPagePath('pg1'),
    publicPath: '/join/justin/financial-empowerment-families',
    extra: {
      question: 'What does a first session look like?',
      questionId: 'q1',
      reason: 'The price on it was out of date.',
      changeRequest: 'Please say "workshops" <not> classes.',
      answerText: 'We meet for an hour and set three goals.',
      note: 'I changed the audience wording.',
      summary: 'added Business owners',
      requestText: 'A program for teens in Harare.',
      reminderDay: 3,
      sectionsLeft: 2,
      changed: false,
    },
    ...over,
  }
  const suffix = NOTIFY_CATALOG[event].ownerSuffix?.(c) ?? ''
  return { ...c, ownerPath: over.ownerPath ?? coachPagePath(c.ownerRole, c.programId, suffix) }
}

const FORBIDDEN = [/\bnull\b/i, /\bundefined\b/i, /nonprofit/i, /\bgrant/i, /\bseat/i, /\$\d/]

describe('program page notification templates', () => {
  it.each(PROGRAM_PAGE_EVENTS.map((e) => [e]))('%s: no null, no forbidden words, short in-app text, greeting, one button', (event) => {
    const c = ctx(event)
    const t = programPageText(c)
    const m = programPageEmail(c, 'Justin')
    for (const s of [t.title, t.message, m.subject, m.html]) for (const re of FORBIDDEN) expect(s).not.toMatch(re)
    expect(t.title.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(t.message.length).toBeLessThanOrEqual(MESSAGE_MAX)
    expect(t.title.length).toBeGreaterThan(5)
    expect(m.html).toContain('Hi Justin,')
    expect(m.html).not.toContain('Stop emails about this')
  })

  it('owner links open the exact screen, by role', () => {
    expect(programPageEmail(ctx('C2_READY_FIRST'), 'J').html).toContain(`href="${BASE}/coach/programs/pg1/check"`)
    expect(programPageEmail(ctx('C1_QUESTION'), 'J').html).toContain(`${BASE}/coach/programs/pg1/question/q1`)
    expect(programPageEmail(ctx('C5_LIVE'), 'J').html).toContain(`${BASE}/coach/programs/pg1/live`)
    expect(programPageEmail(ctx('C8_TELL_US'), 'J').html).toContain(`href="${BASE}/coach/programs/pg1"`)
    const amb = ctx('C2_READY_FIRST', { ownerRole: 'AMBASSADOR' })
    expect(programPageEmail(amb, 'J').html).toContain(`${BASE}/ambassador/programs/pg1/check`)
    expect(programPageEmail(ctx('C9_REMINDER', { stage: 'QUESTION_OPEN' }), 'J').html).toContain('/coach/programs/pg1/question/q1')
  })

  it('team links go to the team screen and never to the owner screen', () => {
    for (const e of PROGRAM_PAGE_EVENTS.filter((x) => x.startsWith('T') && x !== 'T8_ANOTHER_PROGRAM')) {
      const html = programPageEmail(ctx(e), 'Ana').html
      expect(html).toContain(`${BASE}/admin/program-pages/pg1`)
      expect(html).not.toContain('/coach/programs')
    }
  })

  it('matches the approved mockup copy', () => {
    expect(programPageText(ctx('C2_READY_FIRST')).title).toBe('Your Families page is ready to check')
    expect(programPageText(ctx('C3_CHANGES_MADE')).title).toBe("We've made your changes to your Families page")
    expect(programPageText(ctx('C3_CHANGES_MADE')).message).toBe('Your Families page is ready to check again.')
    expect(programPageText(ctx('C4_UPDATE_READY')).title).toBe('Your updated Families page is ready to check')
    expect(programPageText(ctx('C5_LIVE')).message).toBe('Tap to copy your link and start sharing it.')
    expect(programPageText(ctx('C1_QUESTION')).title).toBe('One question about your Families page')
    expect(programPageText(ctx('C9_REMINDER', { stage: 'READY_TO_CHECK' })).title).toBe('Your Families page is ready for you to check')
    const almost = programPageText(ctx('C9_REMINDER', { stage: 'ANSWERING', group: 'Business owners' }))
    expect(almost.title).toBe('Finish your answers for your Business owners page')
    expect(almost.message).toBe('2 sections to go, about 5 minutes. Tap to continue.')
    const c2 = programPageEmail(ctx('C2_READY_FIRST'), 'Justin').html
    expect(c2).toContain('Check my Families page')
    expect(c2).toContain('put it live with one tap')
    expect(c2).toContain('tell us what to change')
    expect(programPageEmail({ ...ctx('C2_READY_FIRST'), group: ctx('C2_READY_FIRST').programName }, 'Justin').html).toContain('>Check my page<')
    expect(programPageText(ctx('C4_UPDATE_READY')).message).toBe('Your live page stays as it is until you say this version is right.')
    expect(programPageText(ctx('C6_PUBLISHED_ON_BEHALF')).title).toBe('We put your Families page live')
    expect(programPageText(ctx('C10_ANSWERS_RECEIVED')).title).toBe('We have your answers for your Families page')
    expect(programPageEmail(ctx('C10_ANSWERS_RECEIVED'), 'J').html).toContain('See what I sent')
    expect(programPageEmail(ctx('C1_QUESTION'), 'J').html).toContain('Our question')
    expect(programPageEmail(ctx('C9_REMINDER', { stage: 'QUESTION_OPEN' }), 'J').html).toContain('Our question')
    const off = programPageEmail(ctx('C7_OFFLINE'), 'J').html
    expect(off).toContain('See my page status')
    expect(programPageText(ctx('T4_APPROVED')).title).toBe('Justin Moyo pressed "Looks good, put it live" on the Financial Empowerment · Families page')
  })

  it('team emails: group button, no "just reply" line; owner emails keep it; same sign-off as other emails', () => {
    for (const e of PROGRAM_PAGE_EVENTS.filter((x) => x.startsWith('T') && x !== 'T8_ANOTHER_PROGRAM')) {
      const html = programPageEmail(ctx(e), 'Ana').html
      expect(html).toContain('Open the Families page')
      expect(html).not.toContain('Just reply to this email')
    }
    expect(programPageEmail(ctx('C2_READY_FIRST'), 'J').html).toContain('Just reply to this email')
    expect(programPageEmail(ctx('C2_READY_FIRST'), 'J').html).toContain('With gratitude,<br>The NowTransformed team')
  })

  it('T8 links to the queue list', () => {
    expect(programPageEmail(ctx('T8_ANOTHER_PROGRAM'), 'Ana').html).toContain(`href="${BASE}/admin/program-pages"`)
  })

  it('T6 lists one change per line, capitalised, with full stops', () => {
    const c = ctx('T6_NAMES_CHANGED', { extra: { summary: 'added Business owners; renamed Parents to Families' } })
    expect(programPageEmail(c, 'Ana').html).toContain('Added Business owners.<br>Renamed Parents to Families.')
    expect(programPageText(c).message).toBe('Added Business owners. Renamed Parents to Families.')
  })

  it('T7 says what the page waits for in a full sentence', () => {
    expect(programPageText(ctx('T7_STALLED')).message).toBe("Justin Moyo's Financial Empowerment · Families page has been ready for them to check for 10 days. Reminders went out. Please give them a call.")
    expect(programPageText(ctx('T7_STALLED', { stage: 'QUESTION_OPEN' })).message).toContain('has not answered our question')
    expect(programPageText(ctx('T7_STALLED', { stage: 'ANSWERING' })).message).toContain('has not finished them in 10 days.')
  })

  it('push quotes use one pair of curly quotes', () => {
    expect(programPageText(ctx('T3_CHANGES_ASKED')).message).toBe('“Please say "workshops" <not> classes.”')
  })

  it('single-group programs say "your <Program> page", never "null page"', () => {
    const one = { group: 'Financial Empowerment' }
    expect(programPageText(ctx('C2_READY_FIRST', one)).title).toBe('Your Financial Empowerment page is ready to check')
    expect(programPageText(ctx('C10_ANSWERS_RECEIVED', one)).title).toBe('We have your answers for your Financial Empowerment page')
    expect(programPageText(ctx('T1_ANSWERS_SENT', one)).title).toBe('Justin Moyo sent the Financial Empowerment answers')
    expect(teamTag({ programName: 'Financial Empowerment', group: '' })).toBe('Financial Empowerment')
  })

  it('team emails name the owner, program, group and company and quote their words safely', () => {
    const t1 = programPageEmail(ctx('T1_ANSWERS_SENT', { extra: { changed: true, note: 'See <b>this</b>' } }), 'Ana')
    expect(t1.subject).toBe('Justin Moyo changed the Financial Empowerment · Families answers')
    expect(t1.html).toContain('Financial Empowerment · Families (BrightPath Coaching)')
    expect(t1.html).toContain('See &lt;b&gt;this&lt;/b&gt;')
    expect(t1.html).not.toContain('<b>this</b>')
    const t3 = programPageEmail(ctx('T3_CHANGES_ASKED'), 'Ana')
    expect(t3.html).toContain('Please say &quot;workshops&quot; &lt;not&gt; classes.')
    expect(programPageText(ctx('T3_CHANGES_ASKED')).message).toContain('workshops')
    const t2 = programPageEmail(ctx('T2_QUESTION_ANSWERED'), 'Ana')
    expect(t2.html).toContain('What does a first session look like?')
    expect(t2.html).toContain('We meet for an hour and set three goals.')
  })

  it('reasons and quotes are optional', () => {
    const c = ctx('C7_OFFLINE', { extra: {} })
    expect(programPageText(c).message).toBe("We took it offline for now. While it's offline, your link takes people to your main sign-up page.")
    expect(programPageEmail(c, 'Justin').html).not.toContain('blockquote')
  })

  it('in-app text is cut for push', () => {
    const long = 'x'.repeat(600)
    const t = programPageText(ctx('T3_CHANGES_ASKED', { extra: { changeRequest: long } }))
    expect(t.message.length).toBeLessThanOrEqual(MESSAGE_MAX)
    expect(t.message.endsWith('…"') || t.message.endsWith('…')).toBe(true)
  })

  it('C5 email carries the public link and how to copy it', () => {
    const html = programPageEmail(ctx('C5_LIVE'), 'Justin').html
    expect(html).toContain(`${BASE}/join/justin/financial-empowerment-families`)
    expect(html).toContain('Copy my link')
  })
})

describe('batched reminder', () => {
  const a = ctx('C9_REMINDER', { stage: 'READY_TO_CHECK' })
  const b = ctx('C9_REMINDER', { programId: 'pg2', group: 'Business owners', stage: 'ANSWERING' })

  it('one page = the single C9 email linking to that page', () => {
    const m = reminderMessage([{ c: a }], 'Justin')
    expect(m.subject).toBe('Your Families page is ready for you to check')
    expect(m.actionPath).toBe('/coach/programs/pg1/check')
  })

  it('two pages = one email listing each page with its own link', () => {
    const m = reminderMessage([{ c: a }, { c: { ...b, ownerPath: '/coach/programs/pg2' } }], 'Justin')
    expect(m.subject).toBe('2 of your pages need you')
    expect(m.title).toBe('2 of your pages need you')
    expect(m.html).toContain(`${BASE}/coach/programs/pg1/check`)
    expect(m.html).toContain(`${BASE}/coach/programs/pg2"`)
    expect(m.html).toContain('Your Business owners page')
    expect(m.actionPath).toBe('/coach/programs')
    expect(m.message).toBe('Families: ready for you to check. Business owners: 2 sections to go, about 5 minutes.')
    expect(m.html).toContain("Everything you've typed is saved.")
    expect(m.html).not.toContain('last reminder')
    for (const re of FORBIDDEN) expect(m.html).not.toMatch(re)
  })

  it('ready-to-check only: no "saved" line; day 7 says it is the last; several programs show Program · Group', () => {
    const other = ctx('C9_REMINDER', { programId: 'pg3', programName: 'Youth Money Club', group: 'Teens', ownerPath: '/coach/programs/pg3/check', extra: { reminderDay: 7 } })
    const m = reminderMessage([{ c: a }, { c: other }], 'Justin')
    expect(m.html).not.toContain("Everything you've typed is saved.")
    expect(m.html).toContain('Nothing goes live until you say so.')
    expect(m.html).toContain("This is the last reminder we'll send. If now isn't a good time")
    expect(m.message).toBe('Financial Empowerment · Families: ready for you to check. Youth Money Club · Teens: ready for you to check.')
  })
})
