import { describe, it, expect } from 'vitest'
import { canCommentOnAnswers, canEditAnswers, canReadAnswers } from './answer-access'
import { cleanAnswers, isExerciseComplete, readExerciseContent, exerciseContentSchema } from './exercise'
import { nextLessonId, moduleOpensAt, isModuleOpen } from './course-rules'
import { parseInline, parseMarkdown, safeHref, readingMinutes } from './markdown'

const amb = { userId: 'amb', coachUserId: 'coach1' }

describe('answer permissions', () => {
  it('the learner reads and edits their own answers, but cannot comment on them', () => {
    const v = { userId: 'amb', role: 'AMBASSADOR' }
    expect(canReadAnswers(v, amb)).toBe(true)
    expect(canEditAnswers(v, amb)).toBe(true)
    expect(canCommentOnAnswers(v, amb)).toBe(false)
  })

  it("the learner's own coach reads and comments, never edits", () => {
    const v = { userId: 'coach1', role: 'COACH' }
    expect(canReadAnswers(v, amb)).toBe(true)
    expect(canCommentOnAnswers(v, amb)).toBe(true)
    expect(canEditAnswers(v, amb)).toBe(false)
  })

  it('another coach, another ambassador, a parent or an associate sees nothing', () => {
    for (const v of [
      { userId: 'coach2', role: 'COACH' },
      { userId: 'amb2', role: 'AMBASSADOR' },
      { userId: 'p', role: 'PARENT' },
      { userId: 'v', role: 'VOLUNTEER' },
      { userId: 's', role: 'SUB_ADMIN' },
    ]) {
      expect(canReadAnswers(v, amb)).toBe(false)
      expect(canCommentOnAnswers(v, amb)).toBe(false)
    }
  })

  it('the coach user viewing as ambassador (not COACH view) does not get coach rights', () => {
    expect(canReadAnswers({ userId: 'coach1', role: 'AMBASSADOR' }, amb)).toBe(false)
  })

  it('a coach learner with no coach: only themselves and admins', () => {
    const coachLearner = { userId: 'coach1', coachUserId: null }
    expect(canReadAnswers({ userId: 'coach2', role: 'COACH' }, coachLearner)).toBe(false)
    expect(canReadAnswers({ userId: 'admin', role: 'ADMIN' }, coachLearner)).toBe(true)
  })

  it('admins read and comment; viewing as someone they can read but not edit or comment', () => {
    expect(canReadAnswers({ userId: 'admin', role: 'ADMIN' }, amb)).toBe(true)
    expect(canCommentOnAnswers({ userId: 'admin', role: 'ADMIN' }, amb)).toBe(true)
    const viewingAs = { userId: 'amb', role: 'AMBASSADOR', isImpersonating: true }
    expect(canReadAnswers(viewingAs, amb)).toBe(true)
    expect(canEditAnswers(viewingAs, amb)).toBe(false)
    expect(canCommentOnAnswers({ userId: 'admin', role: 'ADMIN', isImpersonating: true }, amb)).toBe(false)
  })

  it('empty ids never match', () => {
    expect(canReadAnswers({ userId: '', role: 'AMBASSADOR' }, { userId: '', coachUserId: null })).toBe(false)
  })
})

describe('exercise answers', () => {
  const content = readExerciseContent({
    prompts: [
      { id: 'p1', kind: 'text', label: 'Why?' },
      { id: 'p2', kind: 'single', label: 'Pick', options: ['A', 'B'] },
      { id: 'p3', kind: 'multi', label: 'Any', options: ['X', 'Y', 'Z'] },
    ],
  })

  it('drops unknown prompts, invalid choices and caps long text', () => {
    const a = cleanAnswers(content, { p1: 'x'.repeat(6000), p2: 'C', p3: ['Z', 'nope', 'X'], hack: 'y' })
    expect((a.p1 as string).length).toBe(5000)
    expect(a.p2).toBeUndefined()
    expect(a.p3).toEqual(['X', 'Z'])
    expect('hack' in a).toBe(false)
  })

  it('is complete only when every prompt has an answer', () => {
    expect(isExerciseComplete(content, { p1: 'yes', p2: 'A' })).toBe(false)
    expect(isExerciseComplete(content, { p1: '  ', p2: 'A', p3: ['X'] })).toBe(false)
    expect(isExerciseComplete(content, { p1: 'yes', p2: 'A', p3: ['X'] })).toBe(true)
    expect(isExerciseComplete({ prompts: [] }, {})).toBe(false)
  })

  it('validates content: choice needs two options, ids unique', () => {
    expect(exerciseContentSchema.safeParse({ prompts: [{ id: 'a', kind: 'single', label: 'x', options: ['one'] }] }).success).toBe(false)
    expect(exerciseContentSchema.safeParse({ prompts: [{ id: 'a', kind: 'text', label: 'x' }, { id: 'a', kind: 'text', label: 'y' }] }).success).toBe(false)
    expect(readExerciseContent('garbage').prompts).toEqual([])
  })
})

describe('course rules', () => {
  const mods = [
    { lessons: [{ id: 'a', completed: true }, { id: 'b', completed: false }] },
    { lessons: [{ id: 'c', completed: false }] },
  ]
  it('resumes the first unfinished lesson', () => {
    expect(nextLessonId(mods)).toBe('b')
  })
  it('skips locked drip modules and falls back to the first lesson', () => {
    const enrolledAt = new Date('2026-01-01T00:00:00Z')
    const done = [{ lessons: [{ id: 'a', completed: true }] }, { lessons: [{ id: 'c', completed: false }] }]
    expect(nextLessonId(done, { enrolledAt, dripDays: 7, now: new Date('2026-01-03T00:00:00Z') })).toBe('a')
    expect(nextLessonId(done, { enrolledAt, dripDays: 7, now: new Date('2026-01-09T00:00:00Z') })).toBe('c')
    expect(moduleOpensAt(0, enrolledAt, 7)).toBeNull()
    expect(isModuleOpen(2, enrolledAt, null)).toBe(true)
  })
  it('no lessons -> null', () => {
    expect(nextLessonId([])).toBeNull()
  })
})

describe('markdown renderer data', () => {
  it('parses headings, lists, tables, callouts, images', () => {
    const b = parseMarkdown('## Hi\n\n- a\n- b\n\n1. one\n2. two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> **Tip:** go\n\n![alt](https://x.org/i.png)\n\n![bad](javascript:alert)\n\nPlain\ntext')
    expect(b.map((x) => x.type)).toEqual(['heading', 'list', 'list', 'table', 'quote', 'image', 'paragraph'])
    expect(b[4]).toEqual({ type: 'quote', label: 'Tip', text: 'go' })
  })
  it('inline marks and unsafe links', () => {
    expect(parseInline('**b** and *i* `c`').map((x) => x.t)).toEqual(['strong', 'text', 'em', 'text', 'code'])
    expect(parseInline('[x](javascript:alert(1))')[0]).toEqual({ t: 'text', v: 'x' })
    expect(safeHref('/ambassador/learning')).toBe('/ambassador/learning')
    expect(safeHref('//evil.com')).toBeNull()
  })
  it('reading minutes', () => {
    expect(readingMinutes(0)).toBe(0)
    expect(readingMinutes(50)).toBe(1)
    expect(readingMinutes(1000)).toBe(5)
  })
})
