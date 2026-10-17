import { describe, expect, it } from 'vitest'

import type { TileHex } from '#/front/ui/canvas/state/useCanvasState'
import type { ToldPart } from '#/front/ui/motion'

import { tutorialRules, tutorialTells } from './rules'

// The tutorial's rules, from the view the URL asks for and what the agent has told of its center's
// words: what it shows, and what it lets through to the canvas and the chat.

/** A Tile of the tutorial's canvas, drawn in this role. */
const drawn = (role: TileHex['role']) => ({ role }) as TileHex

const roles = ['center', 'branch', 'leaf', 'context'] as const

describe("the tutorial's arrival", () => {
  it('shows its center alone and large, as /tutorial asks', () => {
    expect(tutorialRules({}).view).toEqual({})
  })

  it('lets nothing through: no menu, no hover card, no composer', () => {
    const { looking, composer } = tutorialRules({}, 'body')
    expect({ looking, composer }).toEqual({ looking: false, composer: false })
  })

  it("tells its center's words in turn, its title, its preview, then its body", () => {
    expect(tutorialTells({})).toBe(true)
  })

  it.each([undefined, 'body'] as const)(
    'shows no line of the body as a tile while the agent has told %s, the six not there',
    (told: ToldPart | undefined) => {
      expect(tutorialRules({}, told).sameSix).toBe(false)
    },
  )

  it.each([undefined, 'title', 'preview'] as const)(
    'leaves every Tile without a click while the agent has told %s',
    (told: ToldPart | undefined) => {
      const rules = tutorialRules({}, told)
      expect(roles.map((role) => rules.lets(drawn(role)).click)).toEqual([
        false,
        false,
        false,
        false,
      ])
      expect(rules.introducesOpening).toBe(false)
    },
  )

  it('lifts opening the center once its body is told, and nothing else', () => {
    const rules = tutorialRules({}, 'body')
    expect(rules.lets(drawn('center'))).toEqual({ click: true, recenter: false })
    for (const role of ['branch', 'leaf', 'context'] as const) {
      expect(rules.lets(drawn(role))).toEqual({ click: false, recenter: false })
    }
    expect(rules.introducesOpening).toBe(true)
    expect(rules.view).toEqual({})
  })

  it.each([
    ['a Tile below the center', { center: 'tutorial/3' }],
    ['a Branch open, no ring', { expanded: { 1: 'children' as const } }],
    ['a Context shown', { inner: 'context' as const }],
  ])('shows the center alone for a link asking %s, nothing of it introduced yet', (_, asked) => {
    expect(tutorialRules(asked, 'body').view).toEqual({})
  })
})

describe("the tutorial's center opened", () => {
  const opened = { frame: 'children' as const }

  it('shows its six around it', () => {
    expect(tutorialRules(opened).view).toEqual(opened)
  })

  it("lets the center's click through, which folds it back, and nothing else", () => {
    const rules = tutorialRules(opened)
    expect(rules.lets(drawn('center'))).toEqual({ click: true, recenter: false })
    for (const role of ['branch', 'leaf', 'context'] as const) {
      expect(rules.lets(drawn(role))).toEqual({ click: false, recenter: false })
    }
  })

  it('shows each Tile its hover card alone, no menu, the composer still held back', () => {
    const { looking, composer } = tutorialRules(opened)
    expect({ looking, composer }).toEqual({ looking: 'card', composer: false })
  })

  it('keeps its body told in the chat', () => {
    expect(tutorialTells(opened)).toBe(true)
  })

  it('shows its body and its ring as the same six once its body is told', () => {
    expect(tutorialRules(opened, 'body').sameSix).toBe(true)
  })

  it.each([undefined, 'title', 'preview'] as const)(
    'waits for its body, told again after a reload, while the agent has told %s',
    (told: ToldPart | undefined) => {
      expect(tutorialRules(opened, told).sameSix).toBe(false)
    },
  )

  it('is where a link asking for its ring lands, whatever the agent has told', () => {
    expect(tutorialRules(opened, undefined).view).toEqual(opened)
  })

  it.each(['branches', 'leaves'] as const)(
    'shows its six Children for a link asking its %s around it',
    (frame) => {
      expect(tutorialRules({ frame }).view).toEqual(opened)
    },
  )

  it.each([
    ['a Tile below the center', { center: 'tutorial/2' }],
    ['a Branch open', { expanded: { 1: 'children' as const } }],
    ['a Context shown', { inner: 'context' as const }],
  ])('leaves out %s, introduced by no step', (_, more) => {
    expect(tutorialRules({ ...opened, ...more }).view).toEqual(opened)
  })
})
