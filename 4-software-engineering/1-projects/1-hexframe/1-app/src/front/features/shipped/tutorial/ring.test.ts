import { describe, expect, it } from 'vitest'

import type { TileNode } from '#/front/ui/canvas/view/tiles'

import { pointedAfter, ringOf, toldSixOf, type SixPlaying } from './ring'

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

describe('pointedAfter', () => {
  it('points at the tile pointed at last, and lets go of it alone', () => {
    expect(pointedAfter(undefined, 'a', true)).toBe('a')
    expect(pointedAfter('a', 'b', true)).toBe('b')
    expect(pointedAfter('b', 'a', false)).toBe('b')
    expect(pointedAfter('b', 'b', false)).toBeUndefined()
  })
})

describe('toldSixOf', () => {
  const ring = ringOf(tile, '1. Go in.\n2. Six at most.\n3. Context.')

  /** The same six playing, what each of its callbacks heard kept in `heard`. */
  function playing(pointed?: string) {
    const heard: string[] = []
    const play: SixPlaying = {
      around: { landed: 2, said: 'same' },
      pointed,
      onPoint: (id, pointing) => heard.push(`${id} ${pointing ? 'pointed' : 'let go'}`),
      onShow: (id) => heard.push(`${id} shown`),
    }
    return { six: toldSixOf(ring, play), heard }
  }

  it('says what the agent said and how many landed, and which lines name a tile', () => {
    const { six } = playing()
    expect({ landed: six.landed, said: six.said }).toEqual({ landed: 2, said: 'same' })
    expect([1, 2, 3].map(six.names)).toEqual([true, false, true])
  })

  it('names the line whose tile is pointed at, from either side, none for a tile no line names', () => {
    expect(playing('tutorial/3').six.pointed).toBe(3)
    expect(playing('tutorial/9').six.pointed).toBeUndefined()
    expect(playing().six.pointed).toBeUndefined()
  })

  it('points at the tile a line names, and shows it once clicked, a line naming none doing nothing', () => {
    const { six, heard } = playing()
    six.onPoint(1, true)
    six.onPoint(1, false)
    six.onShow(3)
    six.onPoint(2, true)
    six.onShow(2)
    expect(heard).toEqual([
      'tutorial/1 pointed',
      'tutorial/1 let go',
      'tutorial/3 pointed',
      'tutorial/3 shown',
    ])
  })
})
