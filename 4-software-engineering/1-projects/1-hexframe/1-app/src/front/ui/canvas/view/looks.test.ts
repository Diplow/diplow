import { describe, expect, it } from 'vitest'

import { m } from '#/paraglide/messages'

import type { CanvasHex } from '../geometry/shape'
import { cardOf, listOf, lookOf, placeOf } from './looks'
import type { TileNode } from './tiles'

// What the tile draws of each hex of the canvas: its kind, its words, its foot and its place, read
// off the Tile and where the shape put it.

type TileHex = Extract<CanvasHex, { kind: 'tile' }>

const node = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id.toUpperCase(),
  preview: `What ${id} is`,
  ...more,
})

const hexOf = (tile: TileNode, more: Partial<TileHex> = {}): TileHex => ({
  kind: 'tile',
  key: `tile:${tile.id}`,
  hex: { center: { x: 0, y: 0 }, radius: 100 },
  generation: 1,
  tile,
  role: 'branch',
  ...more,
})

const words = (id: string) => ({ title: id.toUpperCase(), preview: `What ${id} is` })

describe('lookOf', () => {
  it('draws a Branch with its frame at its foot, where its children are', () => {
    const projects = node('projects', {
      branches: { 1: node('hexframe') },
      leaves: { 4: node('notes', { leaf: true }) },
    })
    expect(lookOf(hexOf(projects))).toEqual({
      kind: 'branch',
      words: words('projects'),
      foot: [1, 4],
    })
  })

  it('leaves the foot off every Branch while a tile moves', () => {
    expect(lookOf(hexOf(node('projects')), { moving: true })).toEqual({
      kind: 'branch',
      words: words('projects'),
    })
  })

  it('draws a Leaf, a file in mono, and a clash with the Branch it is numbered as', () => {
    const leaf = hexOf(node('notes', { leaf: true }), { role: 'leaf' })
    expect(lookOf(leaf)).toEqual({ kind: 'leaf', words: words('notes') })
    const file = hexOf(node('build', { leaf: true, file: true }), { role: 'leaf' })
    expect(lookOf(file)).toMatchObject({ kind: 'leaf', file: true })
    const clash = hexOf(node('reading', { leaf: true }), {
      role: 'leaf',
      clash: node('principles'),
    })
    expect(lookOf(clash)).toMatchObject({ kind: 'leaf', clash: 'PRINCIPLES' })
  })

  it('draws the Context teal, a Reference with where its Tile stands, a broken one as broken', () => {
    expect(lookOf(hexOf(node('why'), { role: 'context' }))).toMatchObject({ kind: 'context' })
    const reference = node('principles', { reference: { from: 'Software Engineering' } })
    expect(lookOf(hexOf(reference, { role: 'context' }))).toEqual({
      kind: 'reference',
      words: words('principles'),
      from: 'Software Engineering',
    })
    expect(lookOf(hexOf(node('gone', { broken: true }), { role: 'context' }))).toMatchObject({
      kind: 'broken',
    })
  })

  it("draws the user's Root warm, untitled until they name themselves, and asks for a vault when empty", () => {
    const center = { role: 'center' } as const
    expect(lookOf(hexOf(node('me', { root: 'named' }), center))).toMatchObject({
      kind: 'root',
      foot: [],
    })
    expect(lookOf(hexOf(node('me', { root: 'untitled' }), center))).toEqual({
      kind: 'untitled',
      words: words('me'),
    })
    expect(lookOf(hexOf(node('me', { root: 'empty' }), center))).toEqual({
      kind: 'untitled',
      words: { title: 'ME', preview: m.tile_untitled_preview() },
    })
  })

  it("draws another System's root, Help's, as the Branch it is", () => {
    expect(lookOf(hexOf(node('help'), { role: 'center' }))).toMatchObject({ kind: 'branch' })
  })
})

describe('listOf', () => {
  const list = (names: string[]): Extract<CanvasHex, { kind: 'list' }> => ({
    kind: 'list',
    key: 'list:a',
    hex: { center: { x: 0, y: 0 }, radius: 100 },
    generation: 1,
    tile: node('a'),
    ring: 'children',
    names,
  })

  it('names a short ring whole, under how many it holds', () => {
    expect(listOf(list(['A', 'B', 'C', 'D']))).toEqual({
      kind: 'list',
      words: { title: m.tile_list_title({ count: 4 }) },
      names: ['A', 'B', 'C', 'D'],
    })
  })

  it('names the first few of a longer one, then how many more', () => {
    expect(listOf(list(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])).names).toEqual([
      'A',
      'B',
      'C',
      m.tile_list_more({ count: 5 }),
    ])
  })
})

describe('placeOf', () => {
  it('puts the center at the center, an opened Branch at its heart, and the rest in a ring', () => {
    expect(placeOf(hexOf(node('a'), { role: 'center' }))).toBe('center')
    expect(placeOf(hexOf(node('a'), { role: 'center', alone: true }))).toBe('alone')
    expect(placeOf(hexOf(node('a'), { role: 'hub' }))).toBe('heart')
    expect(placeOf(hexOf(node('a'), { role: 'leaf' }))).toBe('ring')
  })
})

describe('cardOf', () => {
  it('says a preview in full, and nothing more of a plain Branch', () => {
    expect(cardOf(lookOf(hexOf(node('work'))))).toEqual({ description: 'What work is' })
    expect(cardOf(lookOf(hexOf(node('bare', { preview: '' }))))).toEqual({})
  })

  it('notes the Branch a Leaf is numbered as, in the warning colour', () => {
    const notes = node('notes', { leaf: true })
    expect(cardOf(lookOf(hexOf(notes, { role: 'leaf', clash: node('work') })))).toEqual({
      description: 'What notes is',
      notes: [{ text: m.tile_clash({ branch: 'WORK' }), tone: 'warning' }],
    })
  })

  it("notes where a Reference's Tile stands, teal, and a broken one's loss", () => {
    const reference = node('why', { reference: { from: 'Principles' } })
    expect(cardOf(lookOf(hexOf(reference, { role: 'context' }))).notes).toEqual([
      { text: m.tile_reference_from({ place: 'Principles' }), tone: 'context' },
    ])
    const broken = node('gone', { broken: true, preview: '' })
    expect(cardOf(lookOf(hexOf(broken, { role: 'context' })))).toEqual({
      notes: [{ text: m.tile_broken_note() }],
    })
  })
})
