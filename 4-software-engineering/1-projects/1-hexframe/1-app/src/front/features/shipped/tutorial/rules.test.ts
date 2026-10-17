import { describe, expect, it } from 'vitest'

import type { TileHex } from '#/front/ui/canvas/state/useCanvasState'

import { tutorialRules } from './rules'

// The tutorial's rules, from the view the URL asks for: what it shows, and what it lets through to
// the canvas and the chat.

/** A Tile of the tutorial's canvas, drawn in this role. */
const drawn = (role: TileHex['role']) => ({ role }) as TileHex

describe("the tutorial's arrival", () => {
  it('shows its center alone and large, as /tutorial asks', () => {
    expect(tutorialRules({}).view).toEqual({})
  })

  it('lets nothing through: no menu, no composer', () => {
    const { looking, composer } = tutorialRules({})
    expect({ looking, composer }).toEqual({ looking: false, composer: false })
  })

  it("tells its center's words in turn, its title, its preview, then its body", () => {
    expect(tutorialRules({}).tells).toBe(true)
  })

  it.each(['center', 'branch', 'leaf', 'context'] as const)(
    'leaves the %s without a click and the center where it is',
    (role) => {
      expect(tutorialRules({}).lets(drawn(role))).toEqual({ click: false, recenter: false })
    },
  )

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
    expect(tutorialRules(asked).view).toEqual({})
  })
})
