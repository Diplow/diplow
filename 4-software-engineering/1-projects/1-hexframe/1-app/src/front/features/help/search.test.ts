import { describe, expect, it } from 'vitest'

import { fromHelpPage, readHelpSearch, topicOf, turnedTo, withHelp } from './search'

// Home's search param for Help, and where an old link to the Help page lands.

describe("home's search param for Help", () => {
  it('reads a topic, or Help’s Root', () => {
    expect(readHelpSearch({ help: 'help/3' })).toEqual({ help: 'help/3' })
    expect(readHelpSearch({ help: true })).toEqual({ help: true })
  })

  it.each([
    ['absent', {}],
    ['empty', { help: '' }],
    ['false', { help: false }],
    ['a number', { help: 3 }],
  ])('reads the widget closed when %s', (_, search) => {
    expect(readHelpSearch(search)).toEqual({ help: undefined })
  })

  it('names the topic the widget reads, the Root for `true`', () => {
    expect(topicOf({ help: 'help/3' }, 'help')).toBe('help/3')
    expect(topicOf({ help: true }, 'help')).toBe('help')
    expect(topicOf({ help: undefined }, 'help')).toBeUndefined()
  })

  it('writes the topic, or nothing once closed', () => {
    expect(withHelp('help/2')).toEqual({ help: 'help/2' })
    expect(withHelp(undefined)).toEqual({ help: undefined })
  })
})

describe('the widget turned to a topic', () => {
  const current = { center: 'help/1', help: 'help/1' as const, keys: true as const }

  it('keeps the view and every other param, the page turned alone', () => {
    expect(turnedTo(current, 'help/2')).toEqual({ center: 'help/1', help: 'help/2', keys: true })
  })

  it('centers the canvas on the view given, as reading on does', () => {
    expect(turnedTo(current, 'help/2', { center: 'help/2' })).toEqual({
      center: 'help/2',
      frame: undefined,
      inner: undefined,
      expanded: undefined,
      help: 'help/2',
      keys: true,
    })
  })
})

describe('an old link to the Help page', () => {
  it('lands on the same view, the widget open on the Body that was', () => {
    expect(
      fromHelpPage({ center: 'help/3', expanded: { 1: 'children' }, open: 'help/3/1' }),
    ).toEqual({
      center: 'help/3',
      frame: undefined,
      inner: undefined,
      expanded: { 1: 'children' },
      help: 'help/3/1',
    })
  })

  it('opens the widget on Help’s Root when no Body was open, a field it got wrong left out', () => {
    expect(fromHelpPage({ center: '', open: '' })).toEqual({
      center: undefined,
      frame: undefined,
      inner: undefined,
      expanded: undefined,
      help: true,
    })
  })
})
