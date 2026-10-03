import { expect, test } from 'claude-code/testing'
import { viewHeight, viewWidth, layoutView, type FrameView, type Placement } from './layout.js'
import type { Direction, Frame, Member, MemberKind, Tile } from './node.js'

const tile = (path: string): Tile => ({ path, title: path, preview: '' })
const branch = (path: string): Member => ({ kind: 'branch', tile: tile(path) })
const ring = (members: Partial<Record<Direction, Member>> = {}) => ({
  members,
  overflow: [],
  clashes: [],
})
const frameOf = (path: string, children: Partial<Record<Direction, Member>> = {}): Frame => ({
  tile: tile(path),
  rings: { children: ring(children), context: ring() },
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

test('depth 1 is the Tile and its ring of six, neighbors sharing a side', () => {
  const view: FrameView = {
    frame: frameOf('/w', { 1: branch('/w/1-a'), 3: branch('/w/3-c') }),
    frameKind: 'children',
  }
  expect(summary(layoutView(view, 1))).toEqual([
    { kind: 'center', direction: undefined, ...at(0, 0), radius: 1 },
    { kind: 'member', direction: 1, ...at(-sqrt3 / 2, -1.5), radius: 1 },
    { kind: 'empty', direction: 2, ...at(sqrt3 / 2, -1.5), radius: 1 },
    { kind: 'member', direction: 3, ...at(sqrt3, 0), radius: 1 },
    { kind: 'empty', direction: 4, ...at(sqrt3 / 2, 1.5), radius: 1 },
    { kind: 'empty', direction: 5, ...at(-sqrt3 / 2, 1.5), radius: 1 },
    { kind: 'empty', direction: 6, ...at(-sqrt3, 0), radius: 1 },
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
  expect(layoutView({ frame, frameKind: 'leaves' }, 1)[1]).toMatchObject({
    kind: 'member',
    frameKind: 'leaves',
    memberKind: 'leaf',
    direction: 1,
  })
  expect(layoutView({ frame, frameKind: 'context' }, 1)[2]).toMatchObject({
    kind: 'member',
    frameKind: 'context',
    memberKind: 'context',
    direction: 2,
  })
  // A Frame kind the folder doesn't offer lays out an empty ring.
  expect(layoutView({ frame, frameKind: 'children' }, 1)[1]).toMatchObject({ kind: 'empty' })
})

test('at depth 1 an expanded member stays one hex', () => {
  const view: FrameView = {
    frame: frameOf('/w', { 1: branch('/w/1-a') }),
    frameKind: 'children',
    expanded: { 1: { frame: frameOf('/w/1-a'), frameKind: 'children' } },
  }
  expect(layoutView(view, 1)).toHaveLength(7)
  expect(layoutView(view, 1)[1]).toMatchObject({ kind: 'member', direction: 1 })
})

test('at depth 2 an expanded member shows its own Frame inside its hex, a third of its size', () => {
  const view: FrameView = {
    frame: frameOf('/w', { 1: branch('/w/1-a'), 3: branch('/w/3-c') }),
    frameKind: 'children',
    expanded: {
      3: { frame: frameOf('/w/3-c', { 6: branch('/w/3-c/6-f') }), frameKind: 'children' },
    },
  }
  const placements = layoutView(view, 2)
  expect(placements).toHaveLength(13)
  const inner = summary(placements).slice(3, 10)
  expect(inner[0]).toEqual({ kind: 'center', direction: undefined, ...at(sqrt3, 0), radius: 0.333 })
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
  expect(placements[3]).toMatchObject({ kind: 'center', tile: { path: '/w/3-c' } })
  expect(placements[9]).toMatchObject({ tile: { path: '/w/3-c/6-f' } })
  // A member the view leaves closed stays one hex, at the first generation's size.
  expect(placements[1]).toMatchObject({ kind: 'member', direction: 1, radius: 1 })
})
