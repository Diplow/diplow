import { describe, expect, it } from 'vitest'

import type { SystemTile } from '#/domains/mapping/entities'
import type { HelpNode } from '#/front/ui/chat/widgets/help/topics'

import { helpNodeOf, readingOf, topicFound } from './nodes'

// Help as the help widget reads it: Mapping's Tiles as topics, and what a topic shows of where it
// stands, its parent's six, and where it reads on.

const node = (id: string, children: HelpNode['children'] = {}): HelpNode => ({
  id,
  title: `T ${id}`,
  preview: `P ${id}`,
  body: `B ${id}`,
  children,
})

// Help's Root with three topics, the third with two of its own.
const help = node('help', {
  1: node('help/1'),
  2: node('help/2'),
  3: node('help/3', { 2: node('help/3/2'), 5: node('help/3/5') }),
})

describe('a topic as the help widget reads it', () => {
  it('stands lit among its parent’s six, its parent’s titles its path, reading on to its own', () => {
    const reading = readingOf(help, 'help/3')
    expect(reading.topic.id).toBe('help/3')
    expect(reading.path).toEqual(['T help'])
    expect(reading.frame).toEqual({
      titles: { 1: 'T help/1', 2: 'T help/2', 3: 'T help/3' },
      ids: { 1: 'help/1', 2: 'help/2', 3: 'help/3' },
      lit: 3,
    })
    expect(reading.readOn).toEqual([
      { id: 'help/3/2', title: 'T help/3/2' },
      { id: 'help/3/5', title: 'T help/3/5' },
    ])
  })

  it('reads on to the next two round its frame when it has none of its own', () => {
    expect(readingOf(help, 'help/1').readOn.map(({ id }) => id)).toEqual(['help/2', 'help/3'])
  })

  it('shows the Root’s own six for the Root, none lit', () => {
    const reading = readingOf(help, 'help')
    expect(reading.path).toEqual([])
    expect(reading.frame.lit).toBeUndefined()
    expect(reading.frame.ids).toEqual({ 1: 'help/1', 2: 'help/2', 3: 'help/3' })
  })

  it('reads Help’s Root for an id Help does not hold', () => {
    expect(readingOf(help, 'help/9').topic.id).toBe('help')
  })
})

describe("Help's Tiles as topics", () => {
  it('keep their words and their Branches by place', () => {
    const tile = (id: string, branches: SystemTile['branches'] = {}) =>
      ({ id, title: id, preview: '', body: `# ${id}`, branches }) as unknown as SystemTile
    expect(helpNodeOf(tile('help', { 2: tile('help/2') }))).toEqual({
      id: 'help',
      title: 'help',
      preview: '',
      body: '# help',
      children: {
        2: { id: 'help/2', title: 'help/2', preview: '', body: '# help/2', children: {} },
      },
    })
  })
})

describe('the topic a few words after /help find', () => {
  it('is the first whose title holds them, case aside, before one whose words do', () => {
    expect(topicFound(help, 'b help/3/5')).toBe('help/3/5')
    expect(topicFound(help, 't help/3')).toBe('help/3')
  })

  it('is none for no words, or words no topic holds', () => {
    expect(topicFound(help, '  ')).toBeUndefined()
    expect(topicFound(help, 'nowhere')).toBeUndefined()
  })
})
