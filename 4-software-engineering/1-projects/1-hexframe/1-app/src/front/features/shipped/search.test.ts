import { describe, expect, it } from 'vitest'

import {
  fromHelpPage,
  readHelpSearch,
  readTutorialSearch,
  topicOf,
  turnedTo,
  tutorialOn,
  tutorialViewOf,
  withHelp,
  withTutorial,
} from './search'

// Home's search params for the Systems hexframe ships, Help's and the tutorial's, and where an old
// link to the Help page lands.

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

describe("home's search param for the tutorial", () => {
  it('reads one of its Tiles, or its Root', () => {
    expect(readTutorialSearch({ tutorial: 'tutorial/3' })).toEqual({ tutorial: 'tutorial/3' })
    expect(readTutorialSearch({ tutorial: true })).toEqual({ tutorial: true })
  })

  it.each([
    ['absent', {}],
    ['empty', { tutorial: '' }],
    ['false', { tutorial: false }],
    ['a number', { tutorial: 3 }],
  ])('reads the tutorial away from the canvas when %s', (_, search) => {
    expect(readTutorialSearch(search)).toEqual({ tutorial: undefined })
  })

  it('writes the Tile it is on, or nothing once gone', () => {
    expect(withTutorial(true)).toEqual({ tutorial: true })
    expect(withTutorial('tutorial/2')).toEqual({ tutorial: 'tutorial/2' })
    expect(withTutorial(undefined)).toEqual({ tutorial: undefined })
  })
})

describe("the tutorial's view on the canvas", () => {
  it("is the URL's, its Root alone when the URL names no Tile", () => {
    expect(tutorialViewOf({ tutorial: true })).toEqual({
      center: undefined,
      frame: undefined,
      inner: undefined,
      expanded: undefined,
    })
    expect(tutorialViewOf({ tutorial: true, center: 'tutorial/2', frame: 'children' })).toEqual({
      center: 'tutorial/2',
      frame: 'children',
      inner: undefined,
      expanded: undefined,
    })
  })

  it('centers the Tile a link names when the URL names no center, the center winning else', () => {
    expect(tutorialViewOf({ tutorial: 'tutorial/4' }).center).toBe('tutorial/4')
    expect(tutorialViewOf({ tutorial: 'tutorial/4', center: 'tutorial' }).center).toBe('tutorial')
  })

  it('moves with the canvas, its param following the Tile centered, the rest kept', () => {
    const current = { tutorial: true as const, keys: true as const, center: undefined }
    expect(tutorialOn(current, { center: 'tutorial/5', frame: 'children' })).toEqual({
      tutorial: 'tutorial/5',
      keys: true,
      center: 'tutorial/5',
      frame: 'children',
      inner: undefined,
      expanded: undefined,
    })
    expect(tutorialOn({ ...current, tutorial: 'tutorial/5' }, {})).toMatchObject({
      tutorial: true,
      center: undefined,
    })
  })
})
