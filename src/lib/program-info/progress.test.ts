import { describe, expect, it } from 'vitest'
import { changedSinceLive, changedSinceSent, diffAnswers, mergeAnswers, missingRequired, missingText, pageProgress, sectionProgress, sharedChanged } from './progress'

const full = {
  summary: 's', audience: 'a', problem: 'p', moments: 'm', offerings: 'o', howItRuns: 'h',
  cost: { price: '$30', frequency: 'monthly' }, faqs: 'f', aboutYou: 'y', mustNotSay: 'Nothing',
}

describe('progress', () => {
  it('is complete with the 10 required answers', () => {
    const p = pageProgress(full)
    expect(p).toMatchObject({ sectionsDone: 5, sectionsTotal: 5, complete: true, nextSectionId: null, missingText: '' })
  })
  it('names part-done sections with the count and untouched ones alone', () => {
    const { cost: _c, faqs: _f, ...rest } = full
    void _c; void _f
    expect(missingText(rest)).toBe('What you offer (1 answer) and Before they say yes')
    expect(missingRequired(rest).map((m) => m.key)).toEqual(['cost', 'faqs'])
    expect(pageProgress(rest)).toMatchObject({ sectionsDone: 3, nextSectionTitle: 'What you offer' })
  })
  it('does not count optional answers toward done, but counts them as answered', () => {
    const s = sectionProgress({ quote: 'x' }).find((x) => x.id === 'yes')!
    expect(s).toMatchObject({ done: false, started: true, requiredTotal: 1, requiredAnswered: 0 })
  })
  it('joins three missing sections with commas', () => {
    expect(missingText({ summary: 's', aboutYou: 'y', mustNotSay: 'n' })).toBe("Who it's for, What you offer and Before they say yes")
  })
})

describe('merge', () => {
  it('takes shared keys from the root only', () => {
    const m = mergeAnswers({ summary: 's', aboutYou: 'stale' }, { aboutYou: 'fresh', programName: 'P' })
    expect(m).toEqual({ summary: 's', aboutYou: 'fresh', programName: 'P' })
  })
  it('treats non-objects as empty', () => {
    expect(mergeAnswers(null, [1])).toEqual({})
  })
})

describe('change detection', () => {
  it('ignores cost and names, and empty vs missing', () => {
    const before = { ...full, programName: 'A', quote: '' }
    const after = { ...full, cost: { price: '$99', frequency: 'yearly' }, programName: 'B' }
    expect(diffAnswers(before, after)).toEqual([])
  })
  it('lists changed answers with their labels', () => {
    const d = diffAnswers(full, { ...full, howItRuns: 'new', aboutYou: 'me' })
    expect(d.map((c) => c.key)).toEqual(['howItRuns', 'aboutYou'])
    expect(d[0]).toMatchObject({ before: 'h', after: 'new', sectionId: 'offer' })
  })
  it('is empty without a snapshot', () => {
    expect(changedSinceSent(null, full, 'WITH_TEAM')).toEqual([])
    expect(changedSinceLive(null, full)).toEqual([])
  })
  it('shows changed-since-sent only while the send is being worked on', () => {
    const after = { ...full, howItRuns: 'new' }
    for (const stage of ['WITH_TEAM', 'QUESTION_OPEN', 'CHANGES_ASKED', 'READY_TO_CHECK']) {
      expect(changedSinceSent(full, after, stage).map((c) => c.key)).toEqual(['howItRuns'])
    }
    for (const stage of ['DONE', 'ANSWERING']) expect(changedSinceSent(full, after, stage)).toEqual([])
  })
  it('spots a shared change', () => {
    expect(sharedChanged(full, { ...full, mustNotSay: 'No promises' })).toBe(true)
    expect(sharedChanged(full, { ...full, faqs: 'other' })).toBe(false)
  })
})
