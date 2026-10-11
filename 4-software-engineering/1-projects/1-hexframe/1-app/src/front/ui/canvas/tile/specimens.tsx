// The tile's specimens in a frame, for its gallery: Software Engineering and its ring, whose Branches
// open in place and whose center shows its Context inside it, scaled with the page, and a hex opened
// in place at 1:1.
import { useEffect, useRef, useState, type ReactElement, type RefObject } from 'react'

import { m } from '#/paraglide/messages'

import { ulysse } from '../fixtures'
import { directions, neighbor, type Direction, type Hex } from '../geometry/geometry'
import { findTile, type TileNode } from '../view/tiles'
import { Ground, Slot } from './places'
import { Tile, type TileKind, type TileMotion, type TileWords } from './Tile'

const origin = { x: 0, y: 0 }

/** A Tile of the fixture System, by its id. */
export function fixture(id: string): TileNode {
  const tile = findTile(ulysse, id)
  if (tile === undefined) throw new Error(`No Tile ${id} in the fixture System`)
  return tile
}

export const wordsOf = ({ title, preview }: TileNode): TileWords => ({ title, preview })

/** The ring of Software Engineering, seated as the shape seats it, the reading list beside Principles. */
const ring: Partial<Record<Direction, { tile: TileNode; kind: TileKind; clash?: string }>> = {
  1: { tile: fixture('projects'), kind: 'branch' },
  2: { tile: fixture('principles'), kind: 'branch' },
  3: { tile: fixture('notes'), kind: 'leaf' },
  4: { tile: fixture('reading-list'), kind: 'leaf', clash: m.tile_clash({ branch: 'Principles' }) },
}

const footOf = (tile: TileNode) =>
  directions.filter((direction) => tile.branches?.[direction] ?? tile.leaves?.[direction])

/** The canvas's units across a frame of radius 110: three hexes wide, and a margin. */
const frameWidth = 600
const frameHeight = 560
const frameRadius = 110
const gap = 0.95

/**
 * Software Engineering and its ring, live: a Branch of the ring opens in place, its six blooming out
 * of its heart, and folds back on a click on its heart; the center shows its Context inside it. Every
 * hex is a child of the <svg> under a stable key, a Tile under its own id whether in the ring or at
 * the heart of its ground, so the keyboard's focus stays on it as it opens and folds.
 */
export function LiveFrame() {
  const svg = useRef<SVGSVGElement>(null)
  const scale = useScale(svg, frameWidth)
  const [opened, setOpened] = useState<Direction | 'center'>()
  const [folding, setFolding] = useState(false)
  const center = fixture('software-engineering')
  const fold = () => {
    setFolding(true)
    setTimeout(() => {
      setOpened(undefined)
      setFolding(false)
    }, 500)
  }
  const centerHex = { center: origin, radius: frameRadius }
  const ringTiles = directions.flatMap((direction) => {
    const hex = neighbor(centerHex, direction)
    const member = ring[direction]
    if (member === undefined)
      return [<Slot key={direction} hex={{ ...hex, radius: frameRadius * gap }} />]
    const { tile, kind, clash } = member
    if (opened === direction) {
      return openedHex({ hex, tile, kind, folding, scale, onClose: fold })
    }
    return [
      <Tile
        key={tile.id}
        hex={{ ...hex, radius: frameRadius * gap }}
        kind={kind}
        words={wordsOf(tile)}
        foot={kind === 'branch' ? footOf(tile) : undefined}
        {...(clash !== undefined && { clash })}
        scale={scale}
        {...(kind === 'branch' && {
          action: {
            label: m.hex_tile_expand({ title: tile.title }),
            onSelect: () => {
              setOpened(direction)
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
      {opened === 'center'
        ? openedHex({
            hex: centerHex,
            tile: center,
            kind: 'branch',
            context: true,
            folding,
            scale,
            onClose: fold,
          })
        : [
            <Tile
              key={center.id}
              hex={{ ...centerHex, radius: frameRadius * gap }}
              kind="branch"
              words={wordsOf(center)}
              place="center"
              scale={scale}
              action={{
                label: m.hex_tile_show_context({ title: center.title }),
                onSelect: () => {
                  setOpened('center')
                },
              }}
            />,
          ]}
      {ringTiles}
    </svg>
  )
}

interface OpenedProps {
  hex: Hex
  tile: TileNode
  kind: TileKind
  /** The center's Context, rather than a Branch's Children. */
  context?: boolean
  folding?: boolean
  scale?: number
  onClose?: () => void
}

/**
 * A hex opened in place: its ground, the tile at its heart, under its own id, and its six blooming
 * out of it, each keyed, to be drawn among the frame's other hexes.
 */
function openedHex({
  hex,
  tile,
  kind,
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
      kind={kind}
      words={{ title: tile.title }}
      place={context ? 'center' : 'heart'}
      scale={scale}
      {...(onClose && {
        action: {
          label: context
            ? m.hex_tile_hide_context({ title: tile.title })
            : m.hex_tile_collapse({ title: tile.title }),
          onSelect: onClose,
        },
      })}
    />,
    ...directions.map((direction, index) => {
      const at = { ...neighbor(heart, direction), radius: heart.radius * gap }
      const member = members?.[direction]
      const key = `${tile.id}:${String(direction)}`
      const motion: TileMotion = {
        way: folding ? 'fold' : 'bloom',
        from: hex.center,
        delay: folding ? 0 : index * 40,
      }
      return member === undefined ? (
        <Slot key={key} hex={at} />
      ) : (
        <Tile
          key={key}
          hex={at}
          kind={context ? 'context' : member.leaf ? 'leaf' : 'branch'}
          words={{ title: member.title }}
          scale={scale}
          motion={motion}
        />
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
      {openedHex({ hex: { center: origin, radius }, tile, kind: 'branch', context })}
    </svg>
  )
}

/** Screen px per unit of an <svg> `width` units wide, as CSS sizes it, kept as it resizes. */
function useScale(svg: RefObject<SVGSVGElement | null>, width: number): number {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const element = svg.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / width)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [svg, width])
  return scale
}
