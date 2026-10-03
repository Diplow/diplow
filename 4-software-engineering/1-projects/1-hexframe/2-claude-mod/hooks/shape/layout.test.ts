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
    { kind: 'center', direction: undefined, ...at(0, 0) },
    { kind: 'member', direction: 1, ...at(-sqrt3 / 2, -1.5) },
    { kind: 'empty', direction: 2, ...at(sqrt3 / 2, -1.5) },
    { kind: 'member', direction: 3, ...at(sqrt3, 0) },
    { kind: 'empty', direction: 4, ...at(sqrt3 / 2, 1.5) },
    { kind: 'empty', direction: 5, ...at(-sqrt3 / 2, 1.5) },
    { kind: 'empty', direction: 6, ...at(-sqrt3, 0) },
  ])
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
