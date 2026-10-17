import { describe, expect, it } from 'vitest'

import { tutorialRules } from './rules'

// The tutorial's rules, from the view the URL asks for: what it shows, and what it lets through to
// the canvas and the chat.

describe("the tutorial's arrival", () => {
  it('shows its center alone and large, as /tutorial asks', () => {
    expect(tutorialRules({}).view).toEqual({})
  })

  it('lets nothing through: no click, no menu, no Context, no going in, no composer', () => {
    expect(tutorialRules({}).lets).toEqual({
      open: false,
      menu: false,
      context: false,
      goIn: false,
      composer: false,
    })
  })

  it.each([
    ['a Tile below the center', { center: 'tutorial/3' }],
    ['the center opened', { frame: 'children' as const }],
    ['a Branch open', { frame: 'children' as const, expanded: { 1: 'children' as const } }],
    ['a Context shown', { inner: 'context' as const }],
    [
      'all of them',
      { center: 'tutorial/2', frame: 'children' as const, inner: 'context' as const },
    ],
  ])('shows the center alone for a link asking %s, nothing of it introduced yet', (_, asked) => {
    expect(tutorialRules(asked)).toEqual(tutorialRules({}))
  })
})
