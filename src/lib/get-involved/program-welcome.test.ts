import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkWelcomeNote, cleanWelcomeNote, programParentLine, programWelcomeParts } from './program-welcome'
import { welcomeEmail, parentConsentEmail } from './emails'
import { draftWelcomeNoteWithAI, trimToSentence, userPrompt } from '../ai/welcome-note-ai'

const NOTE = 'Usawa Health Coaching helps you manage stress, build healthier everyday habits and improve your energy and resilience. It is designed for busy people balancing work, family and personal goals.'

describe('program welcome email', () => {
  it('builds the four paragraphs around the program note', () => {
    const w = programWelcomeParts({ firstName: 'Jordan', inviterName: 'Daniella Munene', programName: 'Usawa Health', note: NOTE })
    expect(w.subject).toBe("Daniella thought you'd like Usawa Health")
    expect(w.paragraphs).toHaveLength(4)
    expect(w.paragraphs[0].map((s) => s.text).join('')).toBe("Hi Jordan, Daniella Munene shared Usawa Health with you because they believe you'd be a great addition to our community.")
    expect(w.paragraphs[1][0].text).toBe(NOTE)
    expect(w.paragraphs[2].map((s) => s.text).join('')).toContain('Personal Development, Professional Development, Talent Development and Community Engagement')
    expect(w.cta).toBe('Book my discovery call')
  })
  it('works without an inviter', () => {
    const w = programWelcomeParts({ firstName: 'Ana', inviterName: null, programName: 'Usawa Health', note: NOTE })
    expect(w.subject).toBe('Your next step with Usawa Health')
    expect(w.paragraphs[0][0].text).toBe('Hi Ana, thanks for your interest in Usawa Health.')
  })
  it('email HTML escapes the note and keeps the booking button', () => {
    const m = welcomeEmail({ firstName: 'Jordan', inviterName: 'Daniella <b>', bookUrl: 'https://x.test/journey/abc', program: { name: 'Usawa & Co', note: 'You <script>learn</script> well, with real support every week.' } })
    expect(m.html).toContain('Usawa &amp; Co')
    expect(m.html).toContain('&lt;script&gt;')
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('https://x.test/journey/abc')
    expect(m.html).toContain('Book my discovery call')
  })
  it('falls back to the standard email with no program', () => {
    const m = welcomeEmail({ firstName: 'Jordan', inviterName: 'Daniella', bookUrl: 'https://x.test/j' })
    expect(m.subject).toBe('Welcome, Jordan: your next step with NowTransformed')
  })
  it('parent email carries the program paragraph', () => {
    const m = parentConsentEmail({ parentName: 'Renee', childFirst: 'Maya', inviterName: 'Daniella', consentUrl: 'https://x.test/c', program: { name: 'Usawa Health', note: NOTE } })
    expect(m.html).toContain('About Usawa Health:')
    expect(programParentLine('X', ' a ')[1].text).toBe('a')
  })
})

describe('note checks', () => {
  it('cleans markdown, quotes and line breaks', () => {
    expect(cleanWelcomeNote('"**Usawa** helps you.\n\nIt is _great_."')).toBe('Usawa helps you. It is great.')
  })
  it('enforces length and no links', () => {
    expect(checkWelcomeNote('Too short.')).toMatch(/at least/)
    expect(checkWelcomeNote('x'.repeat(701))).toMatch(/under 700/)
    expect(checkWelcomeNote(`${NOTE} See https://example.com`)).toMatch(/links/)
    expect(checkWelcomeNote(NOTE)).toBeNull()
  })
})

describe('AI drafting', () => {
  afterEach(() => { vi.unstubAllEnvs() })
  const program = { name: 'Usawa Health', organization: 'USAWA', headline: 'Live Well. Perform Well.', programDescription: 'Practical wellness coaching.' }

  it('is off without a key and makes no request', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const f = vi.fn()
    expect(await draftWelcomeNoteWithAI(program, { fetchImpl: f as unknown as typeof fetch })).toEqual({ ok: false, reason: 'not-configured' })
    expect(f).not.toHaveBeenCalled()
  })
  it('sends the page text and returns a cleaned note', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('OPENAI_MODEL', 'test-model')
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      expect(body.model).toBe('test-model')
      expect(body.messages[1].content).toContain('Live Well. Perform Well.')
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
      return new Response(JSON.stringify({ choices: [{ message: { content: `"${NOTE}"` } }] }), { status: 200 })
    })
    expect(await draftWelcomeNoteWithAI(program, { fetchImpl: f as unknown as typeof fetch })).toEqual({ ok: true, note: NOTE })
  })
  it('reports failure on an API error or an empty answer', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    const err = vi.fn(async () => new Response('nope', { status: 500 }))
    expect(await draftWelcomeNoteWithAI(program, { fetchImpl: err as unknown as typeof fetch })).toEqual({ ok: false, reason: 'failed' })
    const empty = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Hi.' } }] }), { status: 200 }))
    expect(await draftWelcomeNoteWithAI(program, { fetchImpl: empty as unknown as typeof fetch })).toEqual({ ok: false, reason: 'empty' })
  })
  it('prompt leaves out empty fields and trims long drafts at a sentence', () => {
    expect(userPrompt({ name: 'A', organization: 'B', headline: '' })).not.toContain('Headline')
    const long = 'One sentence here that is long enough. '.repeat(30)
    const t = trimToSentence(long.trim(), 700)
    expect(t.length).toBeLessThanOrEqual(700)
    expect(t.endsWith('.')).toBe(true)
  })
})
