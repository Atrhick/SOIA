import { describe, it, expect } from 'vitest'
import { pageOnlyOpenAfter, parseMarkdown } from './markdown'
import { parseModuleFile } from './markdown-import'
import { markdownSpeechUnits } from '../lessons/audio-text'

const MD = `Spoken first.

<!-- page-only -->
**Your time this week**

- Puzzle: 4 minutes
<!-- /page-only -->

Spoken last.`

describe('page-only sections', () => {
  it('hides HTML comments and marks page-only blocks, keeping paragraph positions', () => {
    const blocks = parseMarkdown(MD)
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph', 'list', 'paragraph'])
    expect(blocks.map((b) => !!b.pageOnly)).toEqual([false, true, true, false])
    expect(JSON.stringify(blocks)).not.toContain('<!--')
  })

  it('drops multi-line comments entirely', () => {
    const blocks = parseMarkdown('<!-- note\nfor editors -->\nShown.')
    expect(blocks).toEqual([{ type: 'paragraph', text: 'Shown.' }])
  })

  it('stops a paragraph at a comment line', () => {
    const blocks = parseMarkdown('One line\n<!-- page-only -->\nTable line')
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'One line' },
      { type: 'paragraph', text: 'Table line', pageOnly: true },
    ])
  })

  it('leaves page-only text out of the audio but keeps keys aligned with the page', () => {
    const units = markdownSpeechUnits(MD, 'b1')
    expect(units.map((u) => u.text)).toEqual(['Spoken first.', 'Spoken last.'])
    expect(units[1].key).toBe('b1:3')
  })

  it('tracks whether a section is still open', () => {
    expect(pageOnlyOpenAfter('<!-- page-only -->\nx')).toBe(true)
    expect(pageOnlyOpenAfter('x\n<!-- /page-only -->', true)).toBe(false)
    expect(pageOnlyOpenAfter('plain', true)).toBe(true)
  })

  it('reopens a section that runs across lessons on import', () => {
    const mod = parseModuleFile({
      name: '01-week.md',
      content: `# Week 1\n\n## Extras\n\nSpoken.\n\n<!-- page-only -->\n## References\n\nA source.\n<!-- /page-only -->\n`,
    })
    const refs = mod.lessons.find((l) => l.title === 'References')!
    const block = refs.blocks[0]
    expect(block.type).toBe('TEXT')
    const md = block.type === 'TEXT' ? block.content.content : ''
    expect(parseMarkdown(md).every((b) => b.pageOnly)).toBe(true)
  })
})
