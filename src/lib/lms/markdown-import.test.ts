import { describe, it, expect } from 'vitest'
import { convertExercise, lessonBlocks, parseCourseFolder, parseModuleFile, titleFromFileName } from './markdown-import'

const WEEK1 = `# Week 1: Self-awareness and growth mindset

Who am I, and how can I grow?

## What shapes your thinking

Beliefs are **habits of thought**.

> **Tip:** go slowly.

### Exercise: What shapes you
Take five quiet minutes.

What is one belief about yourself you picked up from someone else?
[Write here]

Which of these sounds most like you?
[Choose one]
- I avoid hard tasks
- I try, then give up
- I keep going

Which supports do you have right now?
[Choose all that apply]
- A coach
- Family
- Friends

Talk about it with your coach this week.

## Growth mindset in practice

Short text.

### A normal heading
No markers here, so this stays text.
`

describe('convertExercise', () => {
  it('turns Write here / Choose one / Choose all into prompts with intro and trailing text', () => {
    const body = WEEK1.split('### Exercise: What shapes you')[1].split('## Growth')[0]
    const r = convertExercise(body)!
    expect(r.exercise.intro).toBe('Take five quiet minutes.')
    expect(r.exercise.prompts).toEqual([
      { id: 'p1', kind: 'text', label: 'What is one belief about yourself you picked up from someone else?' },
      { id: 'p2', kind: 'single', label: 'Which of these sounds most like you?', options: ['I avoid hard tasks', 'I try, then give up', 'I keep going'] },
      { id: 'p3', kind: 'multi', label: 'Which supports do you have right now?', options: ['A coach', 'Family', 'Friends'] },
    ])
    expect(r.after).toBe('Talk about it with your coach this week.')
  })

  it('returns null when there are no markers', () => {
    expect(convertExercise('Just some words.\n- a list')).toBeNull()
  })

  it('accepts an inline marker and runs of underscore lines as one writing space', () => {
    const r = convertExercise('Goal: [Write here]\n\nSteps:\n_____________\n\n_____________\n')!
    expect(r.exercise.prompts.map((p) => [p.kind, p.label])).toEqual([
      ['text', 'Goal:'],
      ['text', 'Steps:'],
    ])
  })

  it('a Choose marker with one option becomes a written answer and warns', () => {
    const warnings: string[] = []
    const r = convertExercise('Pick?\n[Choose one]\n- Only one\n', warnings, 'w1')!
    expect(r.exercise.prompts[0].kind).toBe('text')
    expect(warnings[0]).toMatch(/fewer than two options/)
  })
})

describe('lessonBlocks', () => {
  it('splits text and exercise blocks in order and leaves marker-free ### sections as text', () => {
    const blocks = lessonBlocks('Intro.\n\n### Exercise: Try\nQ?\n[Write here]\n\n---\nAfter rule.\n\n### Plain\nNo markers.')
    expect(blocks.map((b) => b.type)).toEqual(['TEXT', 'EXERCISE', 'TEXT'])
    expect(blocks[1].title).toBe('Try')
    const last = blocks[2]
    expect(last.type === 'TEXT' && last.content.content).toContain('### Plain')
  })

  it('ignores markers inside code fences', () => {
    const blocks = lessonBlocks('### Example\n```\n[Write here]\n```\n')
    expect(blocks.map((b) => b.type)).toEqual(['TEXT'])
  })
})

describe('parseModuleFile', () => {
  it('uses # as module title, first intro paragraph as description, ## as lessons', () => {
    const m = parseModuleFile({ name: 'course/week-01.md', content: WEEK1 })
    expect(m.title).toBe('Week 1: Self-awareness and growth mindset')
    expect(m.description).toBe('Who am I, and how can I grow?')
    expect(m.lessons.map((l) => l.title)).toEqual(['What shapes your thinking', 'Growth mindset in practice'])
    expect(m.lessons[0].blocks.map((b) => b.type)).toEqual(['TEXT', 'EXERCISE', 'TEXT'])
    expect(m.lessons[0].estimatedDuration).toBeGreaterThanOrEqual(5)
    expect(m.lessons[1].blocks.map((b) => b.type)).toEqual(['TEXT'])
  })

  it('a long intro becomes an Overview lesson; no # heading falls back to the file name', () => {
    const long = Array.from({ length: 3 }, (_, i) => `Paragraph ${i} with words.`).join('\n\n')
    const m = parseModuleFile({ name: 'week-02_values.md', content: `${long}\n\n## Lesson A\nText.` })
    expect(m.title).toBe('Week 02 values')
    expect(m.lessons.map((l) => l.title)).toEqual(['Overview', 'Lesson A'])
  })
})

describe('parseCourseFolder', () => {
  it('reads course.md settings, sorts weeks numerically and skips non-markdown files', () => {
    const course = `# Youth Leadership Workbook\nEight weeks.\n\n## What you'll learn\n- Know yourself\n- Lead others\n\n## Who it's for\nAmbassadors aged 16-24.\n\n## Details\nCategory: Leadership\nTags: ambassadors, workbook\nRoles: Ambassadors\nDrip days: 7\n`
    const r = parseCourseFolder([
      { name: 'w/week-10.md', content: '# Week 10\n\n## L\nx' },
      { name: 'w/week-2.md', content: '# Week 2\n\n## L\nx' },
      { name: 'w/course.md', content: course },
      { name: 'w/cover.png', content: '' },
    ])
    expect(r.title).toBe('Youth Leadership Workbook')
    expect(r.description).toBe('Eight weeks.')
    expect(r.outcomes).toEqual(['Know yourself', 'Lead others'])
    expect(r.audience).toBe('Ambassadors aged 16-24.')
    expect(r.category).toBe('Leadership')
    expect(r.tags).toEqual(['ambassadors', 'workbook'])
    expect(r.allowedRoles).toEqual(['AMBASSADOR'])
    expect(r.dripDays).toBe(7)
    expect(r.modules.map((m) => m.title)).toEqual(['Week 2', 'Week 10'])
    expect(r.warnings.some((w) => /not markdown/.test(w))).toBe(true)
  })

  it('without course.md it defaults roles to both and warns', () => {
    const r = parseCourseFolder([{ name: 'week-1.md', content: '# Week 1\n\n## L\nx' }])
    expect(r.allowedRoles).toEqual(['COACH', 'AMBASSADOR'])
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('titleFromFileName', () => {
    expect(titleFromFileName('a/week-03_habits.md')).toBe('Week 03 habits')
  })
})
