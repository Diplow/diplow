import { expect, test } from 'claude-code/testing'
import { frameHeight, frameWidth, layoutFrame, type FrameView, type Placement } from './layout.js'
import type { Frame, Tile } from './node.js'

const tile = (path: string): Tile => ({ path, title: path, preview: '' })
const frameOf = (path: string, children: Frame['children'] = {}): Frame => ({
  tile: tile(path),
  children,
  context: {},
  overflow: [],
})

const sqrt3 = Math.sqrt(3)
const middle = { x: frameWidth / 2, y: frameHeight / 2 }

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
    frame: frameOf('/w', { 1: tile('/w/1-a'), 3: tile('/w/3-c') }),
    ring: 'children',
  }
  expect(summary(layoutFrame(view, 1))).toEqual([
    { kind: 'center', direction: undefined, ...at(0, 0), radius: 1 },
    { kind: 'member', direction: 1, ...at(-sqrt3 / 2, -1.5), radius: 1 },
    { kind: 'empty', direction: 2, ...at(sqrt3 / 2, -1.5), radius: 1 },
    { kind: 'member', direction: 3, ...at(sqrt3, 0), radius: 1 },
    { kind: 'empty', direction: 4, ...at(sqrt3 / 2, 1.5), radius: 1 },
    { kind: 'empty', direction: 5, ...at(-sqrt3 / 2, 1.5), radius: 1 },
    { kind: 'empty', direction: 6, ...at(-sqrt3, 0), radius: 1 },
  ])
})

test('the context ring lays out the dot folders the same way', () => {
  const frame = { ...frameOf('/w'), context: { 2: tile('/w/.claude') } }
  const placements = layoutFrame({ frame, ring: 'context' }, 1)
  expect(placements[2]).toMatchObject({ kind: 'member', ring: 'context', direction: 2 })
})

test('at depth 1 an expanded member stays one hex', () => {
  const view: FrameView = {
    frame: frameOf('/w', { 1: tile('/w/1-a') }),
    ring: 'children',
    expanded: { 1: { frame: frameOf('/w/1-a'), ring: 'children' } },
  }
  expect(layoutFrame(view, 1)).toHaveLength(7)
  expect(layoutFrame(view, 1)[1]).toMatchObject({ kind: 'member', direction: 1 })
})

test('at depth 2 an expanded member shows its own Frame inside its hex, a third of its size', () => {
  const view: FrameView = {
    frame: frameOf('/w', { 1: tile('/w/1-a'), 3: tile('/w/3-c') }),
    ring: 'children',
    expanded: { 3: { frame: frameOf('/w/3-c', { 6: tile('/w/3-c/6-f') }), ring: 'children' } },
  }
  const placements = layoutFrame(view, 2)
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
