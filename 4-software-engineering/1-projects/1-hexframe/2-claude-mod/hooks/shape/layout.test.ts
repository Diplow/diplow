import { expect, test } from 'claude-code/testing'
import { viewHeight, viewWidth, layoutView, type FrameView, type Placement } from './layout.js'
import type { Direction, Frame, Member, MemberKind, Tile } from './node.js'

const tile = (path: string): Tile => ({ path, title: path, preview: '' })
const branch = (path: string): Member => ({ kind: 'branch', tile: tile(path) })
const ring = (members: Partial<Record<Direction, Member>> = {}) => ({
  overflowing: false as const,
  members,
})
const frameOf = (path: string, children: Partial<Record<Direction, Member>> = {}): Frame => ({
  tile: tile(path),
  rings: { children: { ...ring(children), clashes: [] }, context: ring() },
})

const sqrt3 = Math.sqrt(3)
const middle = { x: viewWidth / 2, y: viewHeight / 2 }

/** Each placement as kind, direction and center, rounded so the floating point reads plainly. */
const summary = (placements: Placement[]) =>
  placements.map((placement) => ({
    kind: placement.kind,
    direction: placement.kind === 'center' ? undefined : placement.direction,
    x: Math.round(placement.center.x * 1000) / 1000,
    y: Math.round(placement.center.y * 1000) / 1000,
    radius: Math.round(placement.radius * 1000) / 1000,
  }))

const at = (dx: number, dy: number) => ({
  x: Math.round((middle.x + dx) * 1000) / 1000,
  y: Math.round((middle.y + dy) * 1000) / 1000,
})

test('a view is the Tile and its ring of six, neighbors sharing a side', () => {
  const view: FrameView = {
    frame: frameOf('/w', { 1: branch('/w/1-a'), 3: branch('/w/3-c') }),
    frameKind: 'children',
  }
  expect(summary(layoutView(view))).toEqual([
    { kind: 'center', direction: undefined, ...at(0, 0), radius: 1 },
    { kind: 'member', direction: 1, ...at(-sqrt3 / 2, -1.5), radius: 1 },
    { kind: 'empty', direction: 2, ...at(sqrt3 / 2, -1.5), radius: 1 },
    { kind: 'member', direction: 3, ...at(sqrt3, 0), radius: 1 },
    { kind: 'empty', direction: 4, ...at(sqrt3 / 2, 1.5), radius: 1 },
    { kind: 'empty', direction: 5, ...at(-sqrt3 / 2, 1.5), radius: 1 },
    { kind: 'empty', direction: 6, ...at(-sqrt3, 0), radius: 1 },
  ])
  expect(layoutView(view).map(({ generation }) => generation)).toEqual([0, 1, 1, 1, 1, 1, 1])
})

test('every Frame kind lays out its ring the same way, each member saying what it holds', () => {
  const held = (kind: MemberKind, path: string): Member => ({ kind, tile: tile(path) })
  const frame: Frame = {
    tile: tile('/w'),
    rings: {
      branches: ring({ 1: held('branch', '/w/1-a') }),
      leaves: ring({ 1: held('leaf', '/w/1-a.md') }),
      context: ring({ 2: held('context', '/w/.claude') }),
    },
  }
  expect(layoutView({ frame, frameKind: 'leaves' })[1]).toMatchObject({
    kind: 'member',
    memberKind: 'leaf',
    direction: 1,
  })
  expect(layoutView({ frame, frameKind: 'context' })[2]).toMatchObject({
    kind: 'member',
    memberKind: 'context',
    direction: 2,
  })
  // A Frame kind the folder doesn't offer lays out an empty ring.
  expect(layoutView({ frame, frameKind: 'children' })[1]).toMatchObject({ kind: 'empty' })
})

test('a ring that overflows places no member: a medium shows it as a list', () => {
  const frame: Frame = {
    tile: tile('/w'),
    rings: {
      leaves: {
        overflowing: true,
        candidates: ['a.md', 'b.md'].map((name) => ({ kind: 'leaf', name })),
        overflow: [{ kind: 'leaf', name: 'b.md' }],
      },
    },
  }
  const placements = layoutView({ frame, frameKind: 'leaves' })
  expect(placements.map(({ kind }) => kind)).toEqual(['center', ...Array(6).fill('empty')])
})

const context = (path: string): Member => ({ kind: 'context', tile: tile(path) })
const withContext = (frame: Frame, members: Partial<Record<Direction, Member>>): Frame => ({
  ...frame,
  rings: { ...frame.rings, context: ring(members) },
})

test('an opened center holds its inner ring inside its own hex, a third of its size', () => {
  const frame = withContext(frameOf('/w', { 1: branch('/w/1-a') }), { 2: context('/w/.claude') })
  const placements = layoutView({ frame, frameKind: 'children', inner: 'context' })
  expect(placements).toHaveLength(14)
  // The center's hex comes first, opened, then its Tile and the inner ring inside it.
  expect(placements[0]).toMatchObject({ kind: 'center', opened: true, radius: 1, generation: 0 })
  expect(summary(placements.slice(1, 8))).toEqual([
    { kind: 'center', direction: undefined, ...at(0, 0), radius: 0.333 },
    { kind: 'empty', direction: 1, ...at(-sqrt3 / 6, -0.5), radius: 0.333 },
    { kind: 'member', direction: 2, ...at(sqrt3 / 6, -0.5), radius: 0.333 },
    { kind: 'empty', direction: 3, ...at(sqrt3 / 3, 0), radius: 0.333 },
    { kind: 'empty', direction: 4, ...at(sqrt3 / 6, 0.5), radius: 0.333 },
    { kind: 'empty', direction: 5, ...at(-sqrt3 / 6, 0.5), radius: 0.333 },
    { kind: 'empty', direction: 6, ...at(-sqrt3 / 3, 0), radius: 0.333 },
  ])
  expect(placements[1]).toMatchObject({ tile: { path: '/w' }, generation: 0 })
  expect(placements[3]).toMatchObject({ memberKind: 'context', generation: 1 })
  // The outer ring keeps its full size around it.
  expect(placements[8]).toMatchObject({ kind: 'member', direction: 1, radius: 1, generation: 1 })
})

test('an expanded member shows its own Frame inside its hex, the third scale', () => {
  const view: FrameView = {
    frame: frameOf('/w', { 1: branch('/w/1-a'), 3: branch('/w/3-c') }),
    frameKind: 'children',
    expanded: {
      3: { frame: frameOf('/w/3-c', { 6: branch('/w/3-c/6-f') }), frameKind: 'children' },
    },
  }
  const placements = layoutView(view)
  expect(placements).toHaveLength(14)
  expect(placements[3]).toMatchObject({ kind: 'member', direction: 3, opened: true, radius: 1 })
  const inner = summary(placements).slice(4, 11)
  // Its Tile stays the member it opens, at the middle of the member's hex.
  expect(placements[4]).toMatchObject({ kind: 'member', direction: 3, tile: { path: '/w/3-c' } })
  expect(inner[0]).toEqual({ kind: 'member', direction: 3, ...at(sqrt3, 0), radius: 0.333 })
  // Its ring touches the member's hex: the east neighbor's east side sits on the hex's east side.
  expect(inner[3]).toEqual({
    kind: 'empty',
    direction: 3,
    ...at(sqrt3 + sqrt3 / 3, 0),
    radius: 0.333,
  })
  expect(inner[6]).toEqual({
    kind: 'member',
    direction: 6,
    ...at(sqrt3 - sqrt3 / 3, 0),
    radius: 0.333,
  })
  expect(placements[10]).toMatchObject({ tile: { path: '/w/3-c/6-f' }, generation: 2 })
  // A member the view leaves closed stays one hex, at the first generation's size.
  expect(placements[1]).toMatchObject({ kind: 'member', direction: 1, radius: 1 })
  expect(placements[1]).not.toHaveProperty('opened')
})

test('a collapsed center fills the view, opened into its inner ring when it keeps one', () => {
  const frame = withContext(frameOf('/w', { 1: branch('/w/1-a') }), { 2: context('/w/.claude') })
  expect(summary(layoutView({ frame }))).toEqual([
    { kind: 'center', direction: undefined, ...at(0, 0), radius: 2.5 },
  ])
  const placements = layoutView({ frame, inner: 'context' })
  expect(placements).toHaveLength(8)
  expect(placements[0]).toMatchObject({ kind: 'center', opened: true, radius: 2.5 })
  expect(placements[1]).toMatchObject({ kind: 'center', tile: { path: '/w' } })
  expect(summary(placements)[3]).toEqual({
    kind: 'member',
    direction: 2,
    ...at((sqrt3 * 2.5) / 6, -2.5 / 2),
    radius: 0.833,
  })
})
