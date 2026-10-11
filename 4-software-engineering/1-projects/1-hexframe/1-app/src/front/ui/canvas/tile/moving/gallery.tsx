// Moving a tile on /design-system, on the fixture System: a frame where a tile is dragged, or moved
// by M or by a button, each free slot offering itself and each Branch its swap, the tile gliding to
// where it lands, or back once the server refuses; then each part held still. Ported from
// components.html's #moving.
import { useEffect, useRef, useState, type RefObject } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../../../atoms/controls/button'
import { toast } from '../../../atoms/Toaster'
import { GalleryGroup, GallerySection, GalleryState } from '../../../gallery/frame'
import { directions, neighbor, type Direction, type Hex, type Point } from '../../geometry/geometry'
import type { Hand } from '../../keys'
import type { TileNode } from '../../view/tiles'
import { noop, Specimen } from '../gallery'
import { directionName } from '../menu/verbs'
import { Slot } from '../places'
import { branchOf, fixture, ring, useScale, wordsOf } from '../specimens'
import { Tile, type TileLook } from '../Tile'
import { dropAt, landed, partOf, type Seats } from './move'
import { Aside, LandingSlot, Lifted, MoveBanner, SwapDisc, useDrag } from './Moving'

export function MovingGallery() {
  const projects = branchOf(fixture('projects'))
  return (
    <GallerySection name="Moving">
      <GalleryGroup title={m.gallery_moving_live()} note={m.gallery_moving_live_note()} />
      <GalleryState label={m.gallery_state_moving_live()}>
        <MovingFrame />
      </GalleryState>
      <GalleryGroup title={m.gallery_moving_parts()} note={m.gallery_moving_parts_note()} />
      <Specimen name={m.gallery_state_moving_lifted()} note={m.gallery_moving_lifted()} radius={76}>
        {(hex) => (
          <Lifted hex={hex}>
            <Tile hex={hex} {...projects} held="pointed" />
          </Lifted>
        )}
      </Specimen>
      <Specimen
        name={m.gallery_state_moving_landing()}
        note={m.gallery_moving_landing()}
        radius={76}
      >
        {(hex) => (
          <LandingSlot hex={hex} action={{ label: m.tile_moving_here(), onSelect: noop }} />
        )}
      </Specimen>
      <Specimen
        name={m.gallery_state_moving_landing_over()}
        note={m.gallery_moving_landing_over()}
        radius={76}
      >
        {(hex) => (
          <LandingSlot hex={hex} over action={{ label: m.tile_moving_here(), onSelect: noop }} />
        )}
      </Specimen>
      <Specimen name={m.gallery_state_moving_swap()} note={m.gallery_moving_swap()} radius={76}>
        {(hex) => (
          <>
            <Tile hex={hex} {...branchOf(fixture('principles'))} />
            <SwapDisc
              hex={hex}
              action={{ label: m.tile_menu_swap_with({ title: 'Principles' }), onSelect: noop }}
            />
          </>
        )}
      </Specimen>
      <Specimen name={m.gallery_state_moving_aside()} note={m.gallery_moving_aside()} radius={76}>
        {(hex) => (
          <Aside>
            <Tile hex={hex} kind="leaf" words={wordsOf(fixture('notes'))} />
          </Aside>
        )}
      </Specimen>
      <GalleryState label={m.gallery_state_moving_banner()}>
        <div className="w-[min(37.5rem,calc(100vw-3rem))]">
          <MoveBanner title={fixture('projects').title} onStop={noop} />
        </div>
      </GalleryState>
    </GallerySection>
  )
}

/** A tile of the frame, and how it is drawn. */
interface Seated {
  tile: TileNode
  look: TileLook
}

type Frame = Partial<Record<Direction, Seated>>

/** A move landing: where from and where to, gliding there, flaring once refused, or gliding back. */
interface Landing {
  from: Direction
  to: Direction
  phase: 'glide' | 'refused' | 'back'
}

const frameWidth = 600
const frameHeight = 560
const frameRadius = 110
const gap = 0.95
const origin = { x: 0, y: 0 }
const centerHex: Hex = { center: origin, radius: frameRadius }
const hearts = Object.fromEntries(
  directions.map((direction) => [direction, neighbor(centerHex, direction).center]),
) as Record<Direction, Point>

const seatsOf = (frame: Frame): Seats =>
  Object.fromEntries(
    Object.entries(frame).map(([direction, seated]) => [
      direction,
      { id: seated.tile.id, swaps: seated.look.kind === 'branch' },
    ]),
  )

/** A CSS duration, `600ms` or `0.6s`, in milliseconds; none with reduced motion. */
function glideOf(svg: SVGSVGElement | null): number {
  if (!svg || matchMedia('(prefers-reduced-motion: reduce)').matches) return 0
  const duration = getComputedStyle(svg).getPropertyValue('--duration-glide').trim()
  const value = parseFloat(duration)
  return duration.endsWith('ms') ? value : value * 1000
}

/**
 * A tile moving in Software Engineering's ring: dragged, or started by M on a focused tile or by a
 * button, ended by Escape or Stop, landed in a free slot or swapped with a Branch, gliding there, or
 * back once the server refuses. The frame's state, and every gesture on it.
 */
function useMove(svg: RefObject<SVGSVGElement | null>) {
  const [frame, setFrame] = useState<Frame>(ring)
  const [moving, setMoving] = useState<Direction>()
  const [landing, setLanding] = useState<Landing>()
  const [over, setOver] = useState<Direction>()
  const [refuses, setRefuses] = useState(false)
  const { dragged, press } = useDrag(svg)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  // Each tile's shape, by its id, to give it the focus back once it has landed or stopped.
  const tiles = useRef(new Map<string, HTMLElement>())
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )
  const seats = seatsOf(frame)
  const after = (ms: number, then: () => void) => {
    timers.current.push(setTimeout(then, ms))
  }
  const focus = (id: string | undefined) => {
    if (id !== undefined) tiles.current.get(id)?.focus()
  }
  const stop = () => {
    if (landing !== undefined || moving === undefined) return
    setMoving(undefined)
    focus(frame[moving]?.tile.id)
  }
  useEffect(() => {
    if (moving === undefined) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') stop()
    }
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('keydown', onKey)
    }
  })
  const land = (to: Direction) => {
    if (moving === undefined || landing !== undefined) return
    const from = moving
    const glide = glideOf(svg.current)
    setOver(undefined)
    setLanding({ from, to, phase: 'glide' })
    after(glide + 40, () => {
      if (refuses) {
        setLanding({ from, to, phase: 'refused' })
        after(450, () => {
          setLanding({ from, to, phase: 'back' })
        })
        after(450 + glide + 40, () => {
          setLanding(undefined)
          toast(m.gallery_moving_refused())
        })
        return
      }
      const id = frame[from]?.tile.id
      setFrame((current) => landed(current, from, to))
      setLanding(undefined)
      setMoving(undefined)
      requestAnimationFrame(() => {
        focus(id)
      })
    })
  }
  const start = (direction: Direction) => {
    if (landing === undefined && frame[direction] !== undefined) setMoving(direction)
  }
  const reach = { seats, reach: frameRadius * 0.8 }
  /** What a seated tile is handed: M starts its move, a mouse drags it, its shape kept for focus. */
  const handOf = (direction: Direction, { id, title }: TileNode): Hand => ({
    'aria-label': title,
    'aria-keyshortcuts': 'M',
    ref: (element: HTMLElement | null) => {
      if (element) tiles.current.set(id, element)
      else tiles.current.delete(id)
    },
    onKeyDown: (event) => {
      if (event.key.toLowerCase() === 'm' && !event.metaKey && !event.ctrlKey) start(direction)
    },
    onPointerDown: (event) => {
      if (moving !== undefined && moving !== direction) return
      press(event, {
        onStart: () => {
          start(direction)
        },
        onMove: ({ at }) => {
          setOver(dropAt(at, hearts, { ...reach, from: direction }))
        },
        onDrop: (released) => {
          const to = released && dropAt(released.at, hearts, { ...reach, from: direction })
          setOver(undefined)
          if (to !== undefined) land(to)
        },
      })
    },
  })
  return {
    frame,
    seats,
    moving,
    landing,
    over,
    refuses,
    setRefuses,
    dragged,
    start,
    stop,
    land,
    handOf,
  }
}

type Move = ReturnType<typeof useMove>

/** Where a seat is drawn, from its heart: where the drag has it, or the landing, or nowhere else. */
function shiftOf({ dragged, moving, landing, frame }: Move, direction: Direction): Point {
  if (dragged !== undefined && direction === moving) return dragged.offset
  if (landing === undefined || landing.phase === 'back') return origin
  const { from, to } = landing
  const toward = (a: Direction, b: Direction) => ({
    x: hearts[b].x - hearts[a].x,
    y: hearts[b].y - hearts[a].y,
  })
  if (direction === from) return toward(from, to)
  if (direction === to && frame[to] !== undefined) return toward(to, from)
  return origin
}

/**
 * Software Engineering and its ring, where a tile moves: dragged, or by M on a focused tile, or by a
 * button above it; Escape or Stop ends it. "The server refuses" makes the next landing fail, so the
 * tile flares and glides back, and the move goes on.
 */
function MovingFrame() {
  const svg = useRef<SVGSVGElement>(null)
  const scale = useScale(svg, frameWidth)
  const move = useMove(svg)
  const { frame, seats, moving, landing, over, land } = move
  const movingTitle = moving === undefined ? undefined : frame[moving]?.tile.title
  const center = (
    <Tile
      hex={{ ...centerHex, radius: frameRadius * gap }}
      kind="branch"
      words={wordsOf(fixture('software-engineering'))}
      place="center"
      scale={scale}
    />
  )
  return (
    <div className="grid w-[min(37.5rem,calc(100vw-3rem))] gap-2">
      <MoveControls move={move} />
      <div className="min-h-9">
        {movingTitle !== undefined && <MoveBanner title={movingTitle} onStop={move.stop} />}
      </div>
      <svg
        ref={svg}
        viewBox={`${String(-frameWidth / 2)} ${String(-frameHeight / 2)} ${String(frameWidth)} ${String(frameHeight)}`}
        role="group"
        aria-label={m.gallery_moving_frame()}
        className="w-full touch-pan-y select-none"
      >
        {moving === undefined ? center : <Aside>{center}</Aside>}
        {directions.map((direction) => {
          if (frame[direction] !== undefined) return null
          const hex = { center: hearts[direction], radius: frameRadius * gap }
          const offers =
            moving !== undefined &&
            landing === undefined &&
            partOf(seats, moving, direction) === 'landing'
          return offers ? (
            <LandingSlot
              key={`free:${String(direction)}`}
              hex={hex}
              over={over === direction}
              action={{
                label: m.tile_menu_move_to({ direction: directionName(direction) }),
                onSelect: () => {
                  land(direction)
                },
              }}
            />
          ) : (
            <Slot key={`free:${String(direction)}`} hex={hex} />
          )
        })}
        {/* The tile on the move is drawn last, above the others it is dragged over. */}
        {[...directions]
          .sort((a, b) => Number(a === moving) - Number(b === moving))
          .map((direction) => {
            const seated = frame[direction]
            return seated === undefined ? null : (
              <SeatedTile
                key={`${seated.tile.id}@${String(direction)}`}
                direction={direction}
                seated={seated}
                move={move}
                scale={scale}
              />
            )
          })}
      </svg>
    </div>
  )
}

/** The buttons above the frame: a tile to move, Stop, and whether the server refuses. */
function MoveControls({ move }: { move: Move }) {
  const { frame, moving, refuses, setRefuses, start, stop } = move
  return (
    <div className="flex flex-wrap items-center gap-1">
      {(['projects', 'notes'] as const).map((id) => {
        const at = directions.find((direction) => frame[direction]?.tile.id === id)
        return (
          <Button
            key={id}
            size="xs"
            variant={at !== undefined && at === moving ? 'secondary' : 'ghost'}
            disabled={at === undefined}
            onClick={() => {
              if (at !== undefined) start(at)
            }}
          >
            {m.gallery_moving_move({ title: fixture(id).title })}
          </Button>
        )
      })}
      <Button size="xs" variant="ghost" onClick={stop} disabled={moving === undefined}>
        {m.tile_moving_stop()}
      </Button>
      <Button
        size="xs"
        variant={refuses ? 'secondary' : 'ghost'}
        aria-pressed={refuses}
        onClick={() => {
          setRefuses((previous) => !previous)
        }}
      >
        {m.gallery_moving_refuses()}
      </Button>
      <span className="text-xs text-faint">{m.gallery_moving_or_drag()}</span>
    </div>
  )
}

/** A tile of the ring: lifted, stepped back or offering its swap while one moves, gliding as it lands. */
function SeatedTile({
  direction,
  seated,
  move,
  scale,
}: {
  direction: Direction
  seated: Seated
  move: Move
  scale: number
}) {
  const { seats, moving, landing, over, dragged, land, handOf } = move
  const hex = { center: hearts[direction], radius: frameRadius * gap }
  const part = moving === undefined ? undefined : partOf(seats, moving, direction)
  const { x, y } = shiftOf(move, direction)
  const refused = landing?.phase === 'refused' && landing.from === direction
  const tile = (
    <Tile
      hex={hex}
      {...seated.look}
      scale={scale}
      {...(refused && { write: 'refused' as const })}
      hand={handOf(direction, seated.tile)}
    />
  )
  return (
    <g
      style={{ transform: `translate(${String(x)}px, ${String(y)}px)` }}
      className={
        dragged !== undefined && direction === moving
          ? undefined
          : 'transition-transform duration-(--duration-glide) ease-glide motion-reduce:transition-none'
      }
    >
      {part === 'lifted' ? (
        <Lifted hex={hex}>{tile}</Lifted>
      ) : part === 'aside' ? (
        <Aside>{tile}</Aside>
      ) : (
        tile
      )}
      {part === 'swap' && landing === undefined ? (
        <SwapDisc
          hex={hex}
          scale={scale}
          over={over === direction}
          action={{
            label: m.tile_menu_swap_with({ title: seated.tile.title }),
            onSelect: () => {
              land(direction)
            },
          }}
        />
      ) : null}
    </g>
  )
}
