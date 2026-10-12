// The tile's specimens in a frame, for its gallery: Software Engineering and its ring, whose Branches
// open in place and whose center folds its ring away and opens it again, as home's does, scaled with
// the page, and a hex opened in place at 1:1.
import { useEffect, useRef, useState, type ReactElement } from 'react'

import { m } from '#/paraglide/messages'

import { ulysse } from '../fixtures'
import { directions, neighbor, type Direction, type Hex } from '../geometry/geometry'
import { movingFor } from '../../motion'
import { useScale } from '../state/useScale'
import { findTile, type TileNode } from '../view/tiles'
import type { Seat } from './moving/move'
import { Ground, Slot } from './places'
import { Tile, type TileLook, type TileMotion, type TileWords } from './Tile'

const origin = { x: 0, y: 0 }

/** A Tile of the fixture System, by its id. */
export function fixture(id: string): TileNode {
  const tile = findTile(ulysse, id)
  if (tile === undefined) throw new Error(`No Tile ${id} in the fixture System`)
  return tile
}

export const wordsOf = ({ title, preview }: TileNode): TileWords => ({ title, preview })

/** A Branch of the fixture System, its frame at its foot where its children are. */
export function branchOf(tile: TileNode): TileLook {
  const foot = directions.filter(
    (direction) => tile.branches?.[direction] ?? tile.leaves?.[direction],
  )
  return { kind: 'branch', words: wordsOf(tile), foot }
}

/**
 * Whether a tile of the fixture System trades places with one on the move: a Branch does. On home,
 * Mapping's `swapsWith` says so.
 */
export const trades = (tile: TileNode) => tile.leaf !== true

/** The ring of Software Engineering, seated as the shape seats it, the reading list beside Principles. */
export const ring: Ring = {
  1: { tile: fixture('projects'), look: branchOf(fixture('projects')) },
  2: { tile: fixture('principles'), look: branchOf(fixture('principles')) },
  3: { tile: fixture('notes'), look: { kind: 'leaf', words: wordsOf(fixture('notes')) } },
  4: {
    tile: fixture('reading-list'),
    look: {
      kind: 'leaf',
      words: wordsOf(fixture('reading-list')),
      clash: 'Principles',
    },
  },
}

/** The canvas's units across a frame of radius 110: three hexes wide, and a margin. */
export const frameWidth = 600
export const frameHeight = 560
export const frameRadius = 110
/** A tile's hex against its slot's, the gap between tiles showing the ground. */
export const gap = 0.95

/** A tile and how it is drawn, seated in a Direction of a frame. */
export type Ring = Partial<Record<Direction, { tile: TileNode; look: TileLook }>>

/** A ring's seats as a move and a picker read them: each tile's title, and whether it trades. */
export function seatsOf(seated: Ring): Partial<Record<Direction, Seat & { title: string }>> {
  return Object.fromEntries(
    Object.entries(seated).map(([direction, { tile }]) => [
      direction,
      { title: tile.title, swaps: trades(tile) },
    ]),
  )
}

/** The center, alone and folded, against the frame's tiles: as large as the frame holds it. */
const aloneRadius = 230

/**
 * Software Engineering and its ring, live: a Branch of the ring opens in place, its six blooming out
 * of its heart, and folds back on a click on its heart; a click on the center folds its ring back into
 * it, which leaves it alone and large, its preview whole, and opens it again, its six blooming. Every
 * hex is a child of the <svg> under a stable key, a Tile under its own id whether in the ring or at
 * the heart of its ground, so the keyboard's focus stays on it as it opens and folds.
 */
export function LiveFrame() {
  const svg = useRef<SVGSVGElement>(null)
  const scale = useScale(svg, { width: frameWidth, height: frameHeight })
  const { opened, alone, bloomed, folding, open, fold, unfold } = useOpened()
  const center = fixture('software-engineering')
  const centerHex = { center: origin, radius: frameRadius }
  const ringTiles = directions.flatMap((direction, order) => {
    const hex = neighbor(centerHex, direction)
    const member = ring[direction]
    if (member === undefined)
      return [<Slot key={direction} hex={{ ...hex, radius: frameRadius * gap }} />]
    const { tile, look } = member
    if (opened === direction)
      return openedHex({
        hex,
        tile,
        folding: folding !== undefined,
        scale,
        onClose: () => {
          fold('branch')
        },
      })
    const motion: TileMotion | undefined =
      folding === 'ring'
        ? { way: 'fold', from: origin }
        : bloomed
          ? { way: 'bloom', from: origin, order }
          : undefined
    return [
      <Tile
        key={tile.id}
        hex={{ ...hex, radius: frameRadius * gap }}
        {...look}
        scale={scale}
        motion={motion}
        {...(look.kind === 'branch' && {
          action: {
            label: m.hex_tile_expand({ title: tile.title }),
            onSelect: () => {
              open(direction)
            },
          },
        })}
      />,
    ]
  })
  return (
    <svg
      ref={svg}
      viewBox={`${String(-frameWidth / 2)} ${String(-frameHeight / 2)} ${String(frameWidth)} ${String(frameHeight)}`}
      role="group"
      aria-label={m.hex_canvas_label({ title: center.title })}
      className="w-[min(37.5rem,calc(100vw-3rem))]"
    >
      <Tile
        key={center.id}
        hex={{ center: origin, radius: (alone ? aloneRadius : frameRadius) * gap }}
        kind="branch"
        words={wordsOf(center)}
        place={alone ? 'alone' : 'center'}
        scale={scale}
        action={{
          label: (alone ? m.hex_tile_expand : m.hex_tile_collapse)({ title: center.title }),
          onSelect: alone
            ? unfold
            : () => {
                fold('ring')
              },
        }}
      />
      {!alone && ringTiles}
    </svg>
  )
}

/**
 * What the frame has opened, and its folds: a Branch of the ring opened in place, or the ring itself
 * folded into the center, which leaves it alone. Each fold plays for `--duration-fold`, at once with
 * reduced motion, then closes; nothing opens or folds while one is under way. The ring blooms back
 * once it has been folded.
 */
function useOpened() {
  const [opened, setOpened] = useState<Direction>()
  const [alone, setAlone] = useState(false)
  const [bloomed, setBloomed] = useState(false)
  const [folding, setFolding] = useState<'branch' | 'ring'>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )
  const open = (direction: Direction) => {
    if (folding === undefined) setOpened(direction)
  }
  const fold = (what: 'branch' | 'ring') => {
    if (folding !== undefined) return
    setFolding(what)
    timer.current = setTimeout(() => {
      setOpened(undefined)
      if (what === 'ring') setAlone(true)
      setFolding(undefined)
    }, movingFor('--duration-fold'))
  }
  const unfold = () => {
    if (folding !== undefined) return
    setAlone(false)
    setBloomed(true)
  }
  return { opened, alone, bloomed, folding, open, fold, unfold }
}

interface OpenedProps {
  hex: Hex
  tile: TileNode
  /** The center's Context, rather than a Branch's Children. */
  context?: boolean
  folding?: boolean
  scale?: number
  onClose?: () => void
}

/** A member of an opened hex, by what it is: a Context tile, a Leaf or a Branch. */
function memberLook(member: TileNode, context: boolean): TileLook {
  const words = { title: member.title }
  if (context) return { kind: 'context', words }
  return member.leaf ? { kind: 'leaf', words } : { kind: 'branch', words }
}

/**
 * A hex opened in place: its ground, the Branch at its heart, under its own id, and its six blooming
 * out of it, each keyed, to be drawn among the frame's other hexes.
 */
function openedHex({
  hex,
  tile,
  context = false,
  folding = false,
  scale = 1,
  onClose,
}: OpenedProps): ReactElement[] {
  const heart = { center: hex.center, radius: hex.radius / 3.2 }
  const members = context ? tile.context : { ...tile.leaves, ...tile.branches }
  return [
    <Ground
      key={`${tile.id}:ground`}
      hex={{ ...hex, radius: hex.radius * gap }}
      context={context}
    />,
    <Tile
      key={tile.id}
      hex={{ ...heart, radius: heart.radius * gap }}
      kind="branch"
      words={{ title: tile.title }}
      place={context ? 'center' : 'heart'}
      scale={scale}
      {...(onClose && {
        action: { label: m.hex_tile_collapse({ title: tile.title }), onSelect: onClose },
      })}
    />,
    ...directions.map((direction, order) => {
      const at = { ...neighbor(heart, direction), radius: heart.radius * gap }
      const member = members?.[direction]
      const key = `${tile.id}:${String(direction)}`
      const motion: TileMotion = folding
        ? { way: 'fold', from: hex.center }
        : { way: 'bloom', from: hex.center, order }
      return member === undefined ? (
        <Slot key={key} hex={at} />
      ) : (
        <Tile key={key} hex={at} {...memberLook(member, context)} scale={scale} motion={motion} />
      )
    }),
  ]
}

/** A Branch opened in place, or the center's Context shown inside it, drawn at 1:1. */
export function OpenedSpecimen({ tile, context = false }: { tile: TileNode; context?: boolean }) {
  const radius = 130
  const size = Math.ceil(Math.sqrt(3) * radius) + 8
  return (
    <svg
      width={size}
      height={2 * radius + 8}
      viewBox={`${String(-size / 2)} ${String(-radius - 4)} ${String(size)} ${String(2 * radius + 8)}`}
    >
      {openedHex({ hex: { center: origin, radius }, tile, context })}
    </svg>
  )
}
