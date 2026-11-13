import { describe, expect, it } from 'vitest'
import { GENERAL_LINE_IDEAS, ideasFor, lineIdeaProblems } from './line-ideas'
import { hasBlank, isPlaybookGuide } from './scripts'

describe('personal line ideas', () => {
  it('spots a [bracket] left in', () => {
    expect(hasBlank('You said [son’s name] has been quiet.')).toBe(true)
    expect(hasBlank('You said Jordan has been quiet.')).toBe(false)
    expect(hasBlank('a [ ] b\n]')).toBe(true)
    expect(hasBlank('[[sponsor')).toBe(false)
  })

  it('prefers the program, then the general ideas for that situation, then "someone I know"', () => {
    const prog = { PARENT: [{ when: 'Teen just moved', line: 'You said the move has been hard on [teen].' }] }
    expect(ideasFor('PARENT', prog)).toBe(prog.PARENT)
    expect(ideasFor('KNOW', prog)).toEqual(GENERAL_LINE_IDEAS.KNOW ?? [])
    expect(ideasFor('NOPE', null)).toEqual(GENERAL_LINE_IDEAS.KNOW ?? [])
  })

  it('accepts guides with or without ideas, and rejects a bad shape', () => {
    const g = { summary: 's', sections: [] }
    expect(isPlaybookGuide(g)).toBe(true)
    expect(isPlaybookGuide({ ...g, lineIdeas: { KNOW: [{ when: 'a', line: 'b' }] } })).toBe(true)
    expect(isPlaybookGuide({ ...g, lineIdeas: { KNOW: [{ when: 'a' }] } })).toBe(false)
    expect(isPlaybookGuide({ ...g, lineIdeas: [] })).toBe(false)
  })

  it('flags weak or unsafe ideas', () => {
    expect(lineIdeaProblems({ when: 'They feel stuck', line: 'You said work has felt stuck lately.' })).toEqual([])
    expect(lineIdeaProblems({ when: 'x', line: 'Start your journey!!' }).length).toBeGreaterThan(1)
    expect(lineIdeaProblems({ when: 'After the divorce', line: 'I know the divorce has been hard.' })).toContain('sensitive subject')
  })

  it('every general idea passes the checks', () => {
    for (const [k, list] of Object.entries(GENERAL_LINE_IDEAS)) for (const i of list ?? []) expect([k, i.line, lineIdeaProblems(i)]).toEqual([k, i.line, []])
  })
})
