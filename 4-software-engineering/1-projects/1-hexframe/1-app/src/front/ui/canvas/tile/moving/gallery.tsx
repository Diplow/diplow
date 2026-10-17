// Moving a tile on /design-system, on the fixture System: a frame where a tile is dragged, or moved
// from a button, as its menu's "Somewhere else…" would, each free slot offering itself and each
// Branch its swap, the tile gliding to where it lands, or back once the server refuses; then each
// part held still. Ported from components.html's #moving.
import { useEffect, useRef, useState, type RefObject } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../../../atoms/controls/button'
import { toast } from '../../../atoms/Toaster'
import { GalleryGroup, GallerySection, GalleryState } from '../../../gallery/frame'
import { directions, neighbor, type Direction, type Hex, type Point } from '../../geometry/geometry'
import type { Hand } from '../../keys'
import { movingFor } from '../../../motion'
import { useScale } from '../../state/useScale'
import { noop, Specimen } from '../gallery'
import { directionName } from '../menu/verbs'
import { Slot } from '../places'
import {
  branchOf,
  fixture,
  frameHeight,
  frameRadius,
  frameWidth,
  gap,
  ring,
  seatsOf,
  wordsOf,
  type Ring,
} from '../specimens'
import { Tile } from '../Tile'
import { useMove, type Target } from '../../state/move/useMove'
import { dropAt, landed, partOf, type Frame } from './move'
import { unitsIn } from './drag'
import { Aside, LandingSlot, Lifted, MoveBanner, SwapDisc, withoutFoot } from './Moving'

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
            <Tile hex={hex} {...withoutFoot(projects)} held="pointed" />
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
            <Tile hex={hex} {...withoutFoot(branchOf(fixture('principles')))} />
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
type Seated = NonNullable<Ring[Direction]>

const origin = { x: 0, y: 0 }
const centerHex: Hex = { center: origin, radius: frameRadius }
const hearts = Object.fromEntries(
  directions.map((direction) => [direction, neighbor(centerHex, direction).center]),
) as Record<Direction, Point>

/** The ring as a move reads it: who trades places; every free slot takes the tile on the fixture. */
const frameOf = (seated: Ring): Frame => ({ seats: seatsOf(seated) })

/** Where the tile of this id sits in the ring, if it does. */
const directionOf = (seated: Ring, id: string) =>
  directions.find((direction) => seated[direction]?.tile.id === id)

/** How long a refused tile flares, then glides back, before the move goes on. */
const refusal = () => 450 + movingFor('--duration-glide') + 40

/**
 * A tile moving in Software Engineering's ring, on the canvas's `useMove`: dragged, or started by a
 * button, ended by Escape or Stop, landed in a free slot or swapped with a Branch, gliding there, or
 * back once "the server" refuses. The frame's state, and every gesture on it.
 */
function useFrameMove(svg: RefObject<SVGSVGElement | null>) {
  const [frame, setFrame] = useState<Ring>(ring)
  const [moving, setMoving] = useState<string>()
  const [refuses, setRefuses] = useState(false)
  // The tile the page just refused, flaring, as the server's refusal would have it.
  const [refused, setRefused] = useState<string>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )
  const offers = frameOf(frame)
  /** The landing of the tile in `from` on `to`, as the page's own server answers it. */
  const landing = (from: Direction, to: Direction) => () => {
    const id = frame[from]?.tile.id
    if (refuses) {
      setRefused(id)
      timer.current = setTimeout(() => {
        setRefused(undefined)
        toast(m.gallery_moving_refused())
      }, refusal())
      return
    }
    setFrame((current) => landed(current, from, to))
    setMoving(undefined)
  }
  const targetOf = (from: Direction, to: Direction): Target => ({
    key: String(to),
    center: hearts[to],
    ...(frame[to] && { partner: frame[to].tile.id }),
    land: landing(from, to),
  })
  const move = useMove({
    units: unitsIn(svg),
    moving,
    onStart: setMoving,
    onStop: () => {
      setMoving(undefined)
    },
    centerOf: (id) => {
      const direction = directionOf(frame, id)
      return direction === undefined ? undefined : hearts[direction]
    },
    dropAt: (point, id) => {
      const from = directionOf(frame, id)
      if (from === undefined) return undefined
      const to = dropAt(point, hearts, { frame: offers, from, reach: frameRadius * 0.8 })
      return to === undefined ? undefined : targetOf(from, to)
    },
    writeOf: (id) => (id === refused ? 'refused' : undefined),
  })
  const at = moving === undefined ? undefined : directionOf(frame, moving)
  /** Lands the tile on the move in `to`, from a button. */
  const landOn = (to: Direction) => {
    if (at !== undefined) move.land(targetOf(at, to))
  }
  return { ...move, frame, offers, moving: at, refused, refuses, setRefuses, setMoving, landOn }
}

type Move = ReturnType<typeof useFrameMove>

/** Whether a landing has its tile in the air, gliding there or back, or flaring: no other starts. */
const inTheAir = ({ landing }: Move) => landing !== undefined && landing !== 'landed'

/**
 * Software Engineering and its ring, where a tile moves: dragged, or from a button above it, as its
 * menu's "Somewhere else…" would; Escape or Stop ends it. "The server refuses" makes the next landing
 * fail, so the tile flares and glides back, and the move goes on.
 */
function MovingFrame() {
  const svg = useRef<SVGSVGElement>(null)
  const scale = useScale(svg, { width: frameWidth, height: frameHeight })
  const move = useFrameMove(svg)
  const { frame, offers, moving, over, dragging } = move
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
        <Aside aside={moving !== undefined}>{center}</Aside>
        {directions.map((direction) => {
          if (frame[direction] !== undefined) return null
          const hex = { center: hearts[direction], radius: frameRadius * gap }
          const takes =
            moving !== undefined &&
            !inTheAir(move) &&
            partOf(offers, moving, direction) === 'landing'
          return takes ? (
            <LandingSlot
              key={`free:${String(direction)}`}
              hex={hex}
              over={over === String(direction)}
              action={{
                label: m.tile_menu_move_to({ direction: directionName(direction) }),
                onSelect: () => {
                  move.landOn(direction)
                },
              }}
            />
          ) : (
            <Slot key={`free:${String(direction)}`} hex={hex} />
          )
        })}
        {/* The tile dragged is drawn last, above the others it is dragged over. */}
        {[...directions]
          .sort(
            (a, b) =>
              Number(frame[a]?.tile.id === dragging) - Number(frame[b]?.tile.id === dragging),
          )
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
  const { frame, moving, refuses, setRefuses, setMoving, stop } = move
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
              if (at !== undefined && !inTheAir(move)) setMoving(id)
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
  const { offers, moving, over, refused, shiftOf, press, tileRef, landOn } = move
  const { id, title } = seated.tile
  const hex = { center: hearts[direction], radius: frameRadius * gap }
  const part = moving === undefined ? undefined : partOf(offers, moving, direction)
  const { by, glides } = shiftOf(id)
  const hand: Hand = {
    'aria-label': title,
    ref: tileRef(id),
    onPointerDown: (event) => {
      press(id, event)
    },
  }
  return (
    <g
      style={{ transform: `translate(${String(by.x)}px, ${String(by.y)}px)` }}
      className={
        glides
          ? 'transition-transform duration-(--duration-glide) ease-glide motion-reduce:transition-none'
          : undefined
      }
    >
      <Aside aside={part === 'aside'}>
        <Lifted hex={hex} lifted={part === 'lifted'}>
          <Tile
            hex={hex}
            {...(moving === undefined ? seated.look : withoutFoot(seated.look))}
            scale={scale}
            {...(refused === id && { write: 'refused' as const })}
            hand={hand}
          />
        </Lifted>
      </Aside>
      {part === 'swap' && !inTheAir(move) ? (
        <SwapDisc
          hex={hex}
          scale={scale}
          over={over === String(direction)}
          action={{
            label: m.tile_menu_swap_with({ title }),
            onSelect: () => {
              landOn(direction)
            },
          }}
        />
      ) : null}
    </g>
  )
}
