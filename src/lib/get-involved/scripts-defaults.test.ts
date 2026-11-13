import { describe, expect, it } from 'vitest'
import { GENERAL_SCRIPTS, GENERAL_TIPS } from './scripts-defaults'
import { SCENARIOS, renderScript, scriptChecks, type ScenarioKey, type ScriptValues } from './scripts'

const ALL = SCENARIOS.flatMap((s) => s.variants.map((v) => ({ scenario: s.key as ScenarioKey, variant: v })))

const values = (over: Partial<ScriptValues> = {}): ScriptValues => ({
  firstName: 'Maria',
  personalLine: 'You mentioned Jordan has a lot of change coming up this year.',
  myName: 'Elizabeth',
  business: 'DreamIt LiveIt',
  program: 'Vision Development',
  programLine: 'four weekly sessions that help teens in foster care plan what comes next',
  link: 'https://example.org/join/x',
  sponsorship: true,
  ...over,
})

describe('GENERAL_SCRIPTS', () => {
  it('has a message for every situation and variant', () => {
    const missing = ALL.filter(({ scenario, variant }) => !GENERAL_SCRIPTS[`${scenario}:${variant}`])
    expect(missing).toEqual([])
  })

  it('has no messages for situations or variants that do not exist', () => {
    const valid = new Set(ALL.map(({ scenario, variant }) => `${scenario}:${variant}`))
    expect(Object.keys(GENERAL_SCRIPTS).filter((k) => !valid.has(k))).toEqual([])
  })

  it.each(ALL)('$scenario $variant passes every check', ({ scenario, variant }) => {
    const t = GENERAL_SCRIPTS[`${scenario}:${variant}`]!
    const failed = scriptChecks(scenario, variant, t).filter((c) => !c.ok).map((c) => c.label)
    expect(failed).toEqual([])
  })

  it.each(ALL)('$scenario $variant reads cleanly with and without sponsored seats', ({ scenario, variant }) => {
    const t = GENERAL_SCRIPTS[`${scenario}:${variant}`]!
    const senders: Partial<ScriptValues>[] = [
      { owns: true },
      { owns: false, ownerFirstName: 'Elizabeth' },
      { owns: false },
      { mainLink: true, business: 'NowTransformed', program: 'NowTransformed', programLine: '' },
      { mainLink: true, business: 'NowTransformed', program: 'NowTransformed', programLine: '', personalLine: '' },
    ]
    for (const sponsorship of [true, false]) for (const sender of senders) {
      const out = renderScript(`${t.subject ?? ''}\n${t.body}`, values({ sponsorship, ...sender }))
      expect(out).not.toMatch(/I run NowTransformed|programs is NowTransformed/)
      expect(out).not.toMatch(/\{[^{}]+\}/) // no fill-in left behind
      expect(out).not.toMatch(/\[\[|\]\]/) // no sponsor block brackets left behind
      expect(out).not.toMatch(/ {2,}|\s[.,?]/) // no double spaces or stray punctuation
      if (t.body.includes('{sponsor line}') && sponsorship) expect(out).toContain('sponsored seat')
      if (!sponsorship) expect(out).not.toMatch(/sponsored seat/)
    }
  })

  it('never says "grant" and never promises a seat', () => {
    for (const t of Object.values(GENERAL_SCRIPTS)) {
      const all = `${t!.subject ?? ''} ${t!.body}`
      expect(all).not.toMatch(/\bgrants?\b/i)
      expect(all).not.toMatch(/you('ll| will) (get|receive) a (free |sponsored )?seat/i)
    }
  })
})

/** Words and phrases from the copy brief that read as AI or marketing copy. */
const BANNED = [
  /hope this finds you/i, /wanted to reach out/i, /\bjourney/i, /\bempower/i, /\bunlock/i, /\bthriv/i,
  /\bnavigat/i, /\belevat/i, /dive into/i, /game[- ]changer/i, /\btransformative/i, /\bholistic/i,
  /in today's world/i, /next level/i, /passionate about/i, /\bresonat/i, /I'd love to/i, /don't hesitate/i,
  /—/, /\bfree program/i,
  // throat-clearing, fake candor, stacked reassurance, praise-the-question openers (critic round)
  /I'll be (honest|straight)/i, /just going to ask/i, /short version/i, /out of the blue/i, /might be random/i,
  /no pressure/i, /no strings/i, /no hard feelings/i, /nobody('s| is) (asking|push)/i,
  /^(good|fair|great|smart) (question|thing to ask|to ask)/im, /rather ask than wonder/i,
  /they tell you/i, /you decide (after|from there)/i,
]
const banned = (text: string) => BANNED.filter((re) => re.test(text)).map(String)

describe('GENERAL_SCRIPTS sound like a person', () => {
  it.each(ALL)('$scenario $variant has none of the banned phrases', ({ scenario, variant }) => {
    const t = GENERAL_SCRIPTS[`${scenario}:${variant}`]!
    expect(banned(`${t.subject ?? ''}\n${t.body}`)).toEqual([])
  })

  it.each(ALL.filter((x) => x.variant !== 'EMAIL'))('$scenario $variant (a text or post) has no colons, semicolons or emojis and at most one "!"', ({ scenario, variant }) => {
    const body = GENERAL_SCRIPTS[`${scenario}:${variant}`]!.body.replace(/\[\[sponsor:/g, '[[sponsor')
    expect(body).not.toMatch(/[:;]/)
    expect(body).not.toMatch(/[\uD83C-\uDBFF][\uDC00-\uDFFF]|[☀-➿]/) // emoji
    expect((body.match(/!/g) ?? []).length).toBeLessThanOrEqual(1)
  })

  it('no two messages end with the same question', () => {
    const seen = new Map<string, string>()
    const dupes: string[] = []
    for (const [k, t] of Object.entries(GENERAL_SCRIPTS)) {
      const q = (t!.body.trim().match(/[^.?!\n]*\?$/)?.[0] ?? '').trim().toLowerCase()
      if (!q) continue
      if (seen.has(q)) dupes.push(`${seen.get(q)} + ${k}: ${q}`)
      else seen.set(q, k)
    }
    expect(dupes).toEqual([])
  })

  it('sponsorship wording says "sponsored seat" when it shows', () => {
    for (const t of Object.values(GENERAL_SCRIPTS)) {
      const blocks = Array.from(`${t!.subject ?? ''} ${t!.body}`.matchAll(/\[\[sponsor:([^\]]*)\]\]/g)).map((m) => m[1])
      for (const b of blocks) expect(b).toMatch(/sponsored seat/)
    }
  })

  it('mentions sponsorship only where cost comes up: price question, parent email, organizations', () => {
    const allowed = new Set(['ASK_PRICE:SHORT', 'PARENT:EMAIL', 'ORG:SHORT', 'ORG:EMAIL'])
    const leaks = Object.entries(GENERAL_SCRIPTS).filter(([k, t]) => !allowed.has(k) && /sponsor/i.test(`${t!.subject ?? ''} ${t!.body}`)).map(([k]) => k)
    expect(leaks).toEqual([])
  })

  it('texts never say "the first step is" (funnel language)', () => {
    const hits = Object.entries(GENERAL_SCRIPTS).filter(([k, t]) => !k.endsWith(':EMAIL') && /first step is/i.test(t!.body)).map(([k]) => k)
    expect(hits).toEqual([])
  })

  it('does not turn the call description into a template', () => {
    const entries = Object.entries(GENERAL_SCRIPTS).map(([k, t]) => [k, `${t!.subject ?? ''} ${t!.body}`] as const)
    // "three weeks" belongs to the "worried about time" reply only
    expect(entries.filter(([k, b]) => k !== 'ASK_TIME:SHORT' && /three weeks|weeks (out|ahead)/i.test(b)).map(([k]) => k)).toEqual([])
    // "explain how it works" / "what you'd like help with" at most once across the whole set
    expect(entries.filter(([, b]) => /explains? how it works|walks? you through how it works/i.test(b)).length).toBeLessThanOrEqual(1)
    expect(entries.filter(([, b]) => /what you'?d (like|want) help with/i.test(b)).length).toBeLessThanOrEqual(1)
    // generic praise instead of a reason from the person
    expect(entries.filter(([, b]) => /get a lot out of it/i.test(b)).map(([k]) => k)).toEqual([])
  })

  it('first messages and follow-ups never push a link or a dollar amount', () => {
    for (const k of ['KNOW', 'INTRO', 'GROUP', 'NEW', 'PARENT', 'ORG', 'FOLLOW_UP', 'LAST'] as const) {
      for (const v of ['SHORT', 'EMAIL'] as const) {
        const t = GENERAL_SCRIPTS[`${k}:${v}`]
        if (t) expect(t.body).not.toMatch(/\{link\}|\$\d/)
      }
    }
  })
})

describe('GENERAL_TIPS', () => {
  it('has 4 or 5 named sections of 3 to 5 short tips, each ending in a full stop', () => {
    expect(GENERAL_TIPS.length).toBeGreaterThanOrEqual(4)
    expect(GENERAL_TIPS.length).toBeLessThanOrEqual(5)
    for (const s of GENERAL_TIPS) {
      expect(s.title.trim()).not.toBe('')
      expect(s.points.length).toBeGreaterThanOrEqual(3)
      expect(s.points.length).toBeLessThanOrEqual(5)
    }
    for (const p of GENERAL_TIPS.flatMap((s) => s.points)) {
      expect(p.trim().endsWith('.')).toBe(true)
      expect(p.length).toBeLessThanOrEqual(260)
      expect(p).not.toMatch(/\bgrants?\b/i)
      expect(banned(p)).toEqual([])
    }
  })
})
