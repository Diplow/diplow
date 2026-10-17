import { describe, expect, it } from 'vitest'

import type { TileNode } from '#/front/ui/canvas/view/tiles'
import type { SixPlaying } from '#/front/ui/motion'

import { ringOf, sameSixOf } from './ring'

// A tile's body and its ring as the same six: each numbered line names the Child in the Direction
// its number says, and that Child names its line back; a line that names no Child lights nothing.
// The chat's side of it, and the tile pointed at from either side.

const child = (id: string): TileNode => ({ id, title: id, preview: '' })

/** A tile with a Branch north-west, a Leaf east, and nothing elsewhere. */
const tile: TileNode = {
  id: 'tutorial',
  title: 'Tutorial',
  preview: '',
  branches: { 1: child('tutorial/1') },
  leaves: { 3: { ...child('tutorial/3'), leaf: true } },
}

describe('ringOf', () => {
  it('ties each numbered line to the Child in its Direction, a Branch or a Leaf, both ways', () => {
    const ring = ringOf(tile, 'The six steps.\n\n1. Go in.\n2. Six at most.\n3. Context.')
    expect([1, 3].map(ring.tileOf)).toEqual(['tutorial/1', 'tutorial/3'])
    expect(['tutorial/1', 'tutorial/3'].map(ring.lineOf)).toEqual([1, 3])
  })

  it('ties nothing to a line whose Direction holds no Child', () => {
    expect(ringOf(tile, '1. Go in.\n2. Six at most.').tileOf(2)).toBeUndefined()
  })

  it('ties nothing to a number that is no Direction', () => {
    const ring = ringOf({ ...tile, branches: { 1: child('tutorial/1') } }, '0. Before.\n7. After.')
    expect([0, 7].map(ring.tileOf)).toEqual([undefined, undefined])
  })

  it('ties no Child its body numbers no line for, nor a line that is not numbered', () => {
    const ring = ringOf(tile, 'Here, the steps.\n\n1 Go in, unnumbered.\n3. Context.')
    expect(ring.lineOf('tutorial/1')).toBeUndefined()
    expect(ring.tileOf(3)).toBe('tutorial/3')
  })

  it('leaves a Child to the first line that names it', () => {
    const ring = ringOf(tile, '1. Go in.\n\nAgain:\n\n1. Go in, again.')
    expect(ring.lineOf('tutorial/1')).toBe(1)
  })
})

describe('sameSixOf', () => {
  const ring = ringOf(tile, '1. Go in.\n2. Six at most.\n3. Context.')

  /** The same six playing on a tile pointed at, kept as a state keeps it, and the tiles shown. */
  function playing(at?: string) {
    const state = { pointed: at, shown: [] as string[] }
    const play: SixPlaying = {
      around: { landed: 2, said: 'same' },
      pointed: at,
      setPointed: (next) => {
        state.pointed = next(state.pointed)
      },
    }
    return { same: sameSixOf(ring, play, (id) => state.shown.push(id)), state }
  }

  it('says what the agent said and how many landed, and which lines name a tile', () => {
    const { six } = playing().same
    expect({ landed: six.landed, said: six.said }).toEqual({ landed: 2, said: 'same' })
    expect([1, 2, 3].map(six.names)).toEqual([true, false, true])
  })

  it('lights the tile pointed at on the canvas, and its line in the chat', () => {
    const { same } = playing('tutorial/3')
    expect({ canvas: same.pointed, chat: same.six.pointed }).toEqual({
      canvas: 'tutorial/3',
      chat: 3,
    })
  })

  it('points at a tile of the ring from the canvas, and lets it go, another let go leaving it', () => {
    const { same, state } = playing()
    same.onPoint('tutorial/1', true)
    same.onPoint('tutorial/3', true)
    same.onPoint('tutorial/1', false)
    expect(state.pointed).toBe('tutorial/3')
    same.onPoint('tutorial/3', false)
    expect(state.pointed).toBeUndefined()
  })

  it('lights nothing for a tile no line names, the center', () => {
    const { same, state } = playing()
    same.onPoint('tutorial', true)
    expect(state.pointed).toBeUndefined()
  })

  it('points at the tile a line names, and shows it once clicked, a line naming none doing nothing', () => {
    const { same, state } = playing()
    same.six.onPoint(1, true)
    expect(state.pointed).toBe('tutorial/1')
    same.six.onPoint(1, false)
    same.six.onPoint(2, true)
    same.six.onShow(2)
    expect(state).toEqual({ pointed: undefined, shown: [] })
    same.six.onShow(3)
    expect(state).toEqual({ pointed: 'tutorial/3', shown: ['tutorial/3'] })
  })
})
