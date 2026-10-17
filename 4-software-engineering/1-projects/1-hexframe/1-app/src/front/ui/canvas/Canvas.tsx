// The canvas: one <svg>, every hex drawn by its light (tile/), a Tile, a free slot, the ground of a
// hex opened in place, laid out by the shape (geometry/shape.ts), its words fitted to its size on
// screen, the center alone and large until a click opens it. The viewBox is the canvas's own
// coordinates, so the page sizes it with CSS and everything inside scales with it. The view is the
// caller's, from the URL: the canvas only says which view comes next, and blooms and folds what a
// hex opens, the center's ring included. Where
// its caller acts on it, each Tile has its menu and its hover card, each free slot its menu, and a
// Tile moves, dragged or from its menu, its banner at the canvas's foot (`hexes.tsx`). Where its
// caller says who touches what, each Tile carries its mark, the chat pointing at it lights it or its
// way, a tile being written or proposed stands in its free slot, and a proposed move draws its arc.
// Where its caller takes a tile carried off it, a tile dragged off the canvas follows the pointer
// over the page, for its caller to hand on. As the center changes, the camera flies from the last
// view to the next (`useCamera`): into a child it zooms in, to a parent out, the last view drawn still
// beneath the next as it flies past and fades. Where its caller introduces opening the center, the
// tutorial's, the center invites the click that would open it, and its six arrive one by one.
import { useRef, useState, type ReactNode, type RefObject } from 'react'
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import { canvasSize, type EmptySlotTarget } from './geometry/shape'
import type { Direction, Point } from './geometry/geometry'
import {
  lookingAt,
  SlotHexView,
  standsFor,
  TileHexView,
  type Acting,
  type Landing,
  type Moving,
} from './hexes'
import type { Action } from './keys'
import { nearestOf } from './state/move/targets'
import type { CarriedTile, CarryInput } from './state/move/carry'
import { useMove } from './state/move/useMove'
import { useCamera } from './state/useCamera'
import {
  useCanvasState,
  type Looking,
  type TileAction,
  type TileHex,
  type TileLets,
} from './state/useCanvasState'
import { useScale } from './state/useScale'
import { useFinger } from './tile/menu/TileMenu'
import { unitsIn } from './tile/moving/drag'
import { Carried, MoveBanner } from './tile/moving/Moving'
import { Arc } from './tile/marks/Marks'
import type { ToldPart } from '../motion'
import { wayTo, type TileMark } from './tile/marks/mark'
import { Ground, Slot } from './tile/places'
import { Tile, type StandingLook, type TileMotion, type TileWrite } from './tile/Tile'
import { listOf, lookOf, placeOf } from './view/looks'
import { pathTo, type TileNode } from './view/tiles'
import type { CanvasView, ViewAction } from './view/view'

export type { Acting, Moving } from './hexes'

/** What is on its way to the System, as the canvas marks it. */
interface Writes {
  /** A Tile's write, by its id: on its way, or just refused; none for a Tile left alone. */
  tile: (id: string) => TileWrite | undefined
  /** Whether an import on its way lands in this free slot, where its tiles will be. */
  landing: (slot: EmptySlotTarget) => boolean
}

/** Acting on what the canvas draws, where it is: each Tile's menu, each free slot's. */
interface CanvasActing {
  /** What a Tile's menu says of it and does; none for a Tile with no menu. */
  tile: (hex: TileHex) => Acting | undefined
  /** What a free slot's menu says of it and does; none for a slot with no menu. */
  slot: (slot: EmptySlotTarget) => Acting | undefined
}

/** A tile standing in a free slot before it is there: its id, and how it is drawn. */
export interface SlotStanding {
  id: string
  look: StandingLook
}

/** Who touches what the canvas draws, as its caller says it (HEX-108). */
export interface CanvasMarks {
  /** What a Tile shows of who touches it, by its id: a Tile drawn, or a tile standing in a slot. */
  tile?: (id: string) => TileMark | undefined
  /** The Tile the chat points at, by its id: lit where it is drawn, its way where it isn't. */
  pointed?: string | undefined
  /** What stands in a free slot before it is there: a tile being written, one a Proposal creates. */
  slot?: (slot: EmptySlotTarget) => SlotStanding | undefined
  /**
   * The part of the center's words the agent tells of, as the chat says it: its title or its preview
   * lit, its body, told in the chat, lighting nothing (HEX-120).
   */
  told?: ToldPart | undefined
  /** A Proposal's moves, each from a Tile to the free slot it would land in, drawn where both are. */
  arcs?: ReadonlyArray<{ from: string; to: { parent: string; direction: Direction } }>
}

/** Moving a Tile: the one on the move, if any, and how a move starts and stops. */
interface CanvasMove {
  moving?: Moving | undefined
  /** A drag starting on a Tile its menu lets move: the move starts with it, by its id. */
  start: (id: string) => void
  /** Escape or Stop. */
  stop: () => void
}

interface CanvasProps {
  /** The System's root Tile, with everything below it. */
  system: TileNode
  view: CanvasView
  /**
   * The next view, after a gesture: the caller puts it in the URL. `action` names the gesture and the
   * Tile it was made on, for a caller that records where the user went.
   */
  onViewChange: (view: CanvasView, action: ViewAction) => void
  /**
   * What a click on an empty slot does, and how a screen reader names it: add a Tile there, move one
   * there; `undefined` for a slot that takes no click. Without it, none does.
   */
  emptySlots?: (slot: EmptySlotTarget) => Action | undefined
  /** Each Tile's menu and hover card, and each free slot's menu. Without it, nothing has one. */
  acting?: CanvasActing
  /**
   * A canvas only looked at, Help's or a page's: without `acting`, each Tile's menu holds the lines
   * that go somewhere alone, Open, Go in, Show its Context, Back out, beside its hover card (`menu`);
   * or its hover card alone (`card`).
   */
  looking?: Looking
  /**
   * What each Tile lets through of the gestures on it, its click and going into it, for a canvas with
   * rules of its own, the tutorial's: a Tile whose click is held back is no button, takes no focus and
   * opens nothing. Without it, every gesture goes through.
   */
  lets?: (hex: TileHex) => TileLets
  /**
   * Opening the center is introduced, the tutorial's: where a click would open it, the center invites
   * that click, the one thing that answers, and its six arrive one by one, `--stagger-step` apart, in
   * their order from the top left (HEX-121).
   */
  introducesOpening?: boolean
  /**
   * A Tile on the move: lifted, its free slots offering themselves where `emptySlots` lands it, the
   * Tiles `swapTargets` names offering their swap on a disc at their foot, no Branch showing its
   * frame there, the rest stepped back, a banner at the canvas's foot. Without it, nothing moves.
   */
  move?: CanvasMove
  /** What is on its way: without it, nothing is. */
  writes?: Writes
  /** Who touches what it draws: without it, nobody does. */
  marks?: CanvasMarks
  /**
   * A Tile dragged off the canvas under a mouse or a pen, carried over the page, as it goes off; none
   * once it comes back or is let go, which ends its move. Without it, a drag stays on the canvas.
   */
  onCarry?: ((tile: CarriedTile | undefined) => void) | undefined
  /**
   * A Tile pointed at, its card open under a mouse, a pen or the keyboard's focus, or its menu under
   * a finger's long press, by its id, and let go: the canvas's end of a crossing, the chat lighting
   * the line that names it (HEX-122). Without it, pointing at a Tile lights nothing elsewhere.
   */
  onPoint?: ((tile: string, pointing: boolean) => void) | undefined
  className?: string
}

export function Canvas(props: CanvasProps) {
  const { system, view, onViewChange, emptySlots, move, writes, marks, onCarry, lets } = props
  const { introducesOpening: introduces = false } = props
  const acting = props.acting ?? lookedAt(system, props.looking)
  const finger = useFinger()
  const { state, actions } = useCanvasState({ system, view, onViewChange, finger, lets })
  const svg = useRef<SVGSVGElement>(null)
  const scale = useScale(svg, canvasSize)
  const { width, height } = canvasSize
  // The hex whose menu is open: the other Tiles step back meanwhile.
  const [menu, setMenu] = useState<string>()
  const moving = move?.moving
  const placed = centersOf(state.hexes)
  const targets = moving === undefined ? [] : targetsOf(state.hexes, { emptySlots, moving })
  const targetAt = new Map(targets.map((target) => [target.key, target]))
  const gesture = useMove({
    units: unitsIn(svg),
    moving: moving?.id,
    onStart: (id) => move?.start(id),
    onStop: () => move?.stop(),
    centerOf: (id) => placed.get(id),
    dropAt: (point) => nearestOf(point, targets),
    writeOf: (id) => writes?.tile(id),
    ...carryOf(svg, state.hexes, onCarry),
  })
  const inTheAir = gesture.landing !== undefined && gesture.landing !== 'landed'
  // While a tile moves, nothing stands in a free slot: they offer themselves to it.
  const standing = moving === undefined ? marks?.slot : undefined
  const markOf = tileMarksOf(system, state.hexes, { ...marks, slot: standing }, state.center.id)
  const onMenu = (key: string) => (open: boolean) => {
    setMenu((current) => (open ? key : current === key ? undefined : current))
  }

  /** A Tile's hex: the tile, by what it is and where it stands, in its menu where it has one. */
  const tileOf = (hex: TileHex) => {
    const action = actions.actionOf(hex)
    const look = lookOf(hex, { moving: moving !== undefined })
    const mark = hex.tile.reference === undefined ? markOf(hex.tile.id) : undefined
    return (
      <TileHexView
        key={hex.key}
        hex={hex}
        look={look}
        mark={mark}
        draw={(hand) => (
          <Tile
            hex={hex.hex}
            {...look}
            place={placeOf(hex)}
            scale={scale}
            write={writes?.tile(hex.tile.id)}
            mark={mark}
            motion={paced(actions.motionOf(hex.key), introduces)}
            invites={introduces && hex.role === 'center' && action === 'expand'}
            action={
              action && {
                label: actionLabel(action, hex.tile.title),
                onSelect: () => {
                  actions.click(hex)
                },
              }
            }
            onGoIn={(from) => {
              actions.center(hex, from)
            }}
            {...(hand && { hand })}
          />
        )}
        acting={acting?.tile(hex)}
        go={(verb) => {
          actions.go(hex, verb)
        }}
        moving={moving}
        aside={menu !== undefined && menu !== hex.key}
        onMenu={onMenu(hex.key)}
        onPoint={pointingAt(hex.tile.id, props.onPoint)}
        shift={hex.tile.reference === undefined ? gesture.shiftOf(hex.tile.id) : still}
        inTheAir={inTheAir}
        swap={targetAt.get(hex.key)}
        over={gesture.over === hex.key}
        scale={scale}
        tileRef={gesture.tileRef(hex.tile.id)}
        press={(event) => {
          gesture.press(hex.tile.id, event)
        }}
        land={gesture.land}
      />
    )
  }

  // The Tile dragged is drawn last, above the others it is dragged over.
  const dragged = (hex: (typeof state.hexes)[number]) =>
    Number(hex.kind === 'tile' && standsFor(hex, gesture.dragging))
  return (
    <div className={cn('flex min-h-0 flex-col gap-2', props.className)}>
      <svg
        ref={svg}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        role="group"
        aria-label={m.hex_canvas_label({ title: state.center.title })}
        className="min-h-0 w-full flex-1 select-none"
      >
        <Camera system={system} center={state.center.id} hexes={state.hexes} scale={scale}>
          {[...state.hexes]
            .sort((a, b) => dragged(a) - dragged(b))
            .map((hex) => {
              switch (hex.kind) {
                case 'ground':
                  return <Ground key={hex.key} hex={hex.hex} context={hex.ring === 'context'} />
                case 'empty': {
                  const stands = standing?.(hex.slot)
                  if (stands !== undefined) {
                    return (
                      <Tile
                        key={hex.key}
                        hex={hex.hex}
                        {...stands.look}
                        scale={scale}
                        mark={markOf(stands.id)}
                      />
                    )
                  }
                  return (
                    <SlotHexView
                      key={hex.key}
                      hex={hex}
                      action={emptySlots?.(hex.slot)}
                      landing={targetAt.get(hex.key)}
                      loading={writes?.landing(hex.slot) ?? false}
                      acting={acting?.slot(hex.slot)}
                      moving={moving !== undefined}
                      inTheAir={inTheAir}
                      over={gesture.over === hex.key}
                      onMenu={onMenu(hex.key)}
                      land={gesture.land}
                    />
                  )
                }
                case 'list':
                  return <Tile key={hex.key} hex={hex.hex} {...listOf(hex)} scale={scale} />
                case 'tile':
                  return tileOf(hex)
              }
            })}
          <Arcs hexes={state.hexes} arcs={marks?.arcs} />
        </Camera>
      </svg>
      {moving === undefined ? null : <MoveBanner title={moving.title} onStop={gesture.stop} />}
      {gesture.carried && (
        <Carried title={titleIn(state.hexes, gesture.carried.id)} at={gesture.carried.at} />
      )}
    </div>
  )
}

/** What a canvas only looked at lets each Tile show: its menu and its card, its card alone, or neither. */
function lookedAt(system: TileNode, looking: Looking = false): CanvasActing | undefined {
  if (looking === false) return undefined
  return {
    tile: (hex) => lookingAt(system, hex, lookOf(hex), looking),
    slot: () => undefined,
  }
}

/** A Tile pointed at and let go, handed on by its id where the caller takes it. */
const pointingAt = (id: string, onPoint: CanvasProps['onPoint']) =>
  onPoint &&
  ((pointing: boolean) => {
    onPoint(id, pointing)
  })

/** A bloom one by one, a step apart, where the canvas introduces opening its center. */
const paced = (motion: TileMotion | undefined, introduces: boolean) =>
  motion && introduces ? { ...motion, paced: true } : motion

interface CameraProps {
  system: TileNode
  /** The centered Tile's id. */
  center: string
  hexes: Hexes
  scale: number
  /** The drawing, as the canvas draws it. */
  children: ReactNode
}

/**
 * The drawing under the camera (`useCamera`): in a group of its own, flying as the center changes,
 * at rest otherwise, and meanwhile the last drawing beneath it, still, which no pointer reaches and
 * no screen reader hears, nothing in it moving but the camera.
 */
function Camera({ system, center, hexes, scale, children }: CameraProps) {
  const camera = useCamera({ system, center, hexes })
  return (
    <>
      {camera.still && (
        <g
          ref={camera.last}
          aria-hidden
          className="pointer-events-none origin-top-left **:animate-none!"
        >
          {camera.still.map((hex) => (
            <StillHex key={hex.key} hex={hex} scale={scale} />
          ))}
        </g>
      )}
      <g ref={camera.drawing} className="origin-top-left ease-camera">
        {children}
      </g>
    </>
  )
}

/** A hex of the last drawing, as it was drawn, acting on nothing: a free slot dotted. */
function StillHex({ hex, scale }: { hex: Hexes[number]; scale: number }) {
  switch (hex.kind) {
    case 'ground':
      return <Ground hex={hex.hex} context={hex.ring === 'context'} />
    case 'empty':
      return <Slot hex={hex.hex} />
    case 'list':
      return <Tile hex={hex.hex} {...listOf(hex)} scale={scale} />
    case 'tile':
      return <Tile hex={hex.hex} {...lookOf(hex)} place={placeOf(hex)} scale={scale} />
  }
}

/**
 * How a Tile dragged off the canvas is carried, where its caller takes it: off the <svg>'s box on the
 * page, told by its id and title.
 */
function carryOf(
  svg: RefObject<SVGSVGElement | null>,
  hexes: Hexes,
  onCarry: CanvasProps['onCarry'],
): CarryInput {
  if (onCarry === undefined) return {}
  return {
    offCanvas: (client) => !within(svg.current?.getBoundingClientRect(), client),
    onCarry: (id) => {
      onCarry(id === undefined ? undefined : { id, title: titleIn(hexes, id) })
    },
  }
}

/** Whether a point of the page is inside a box drawn on it. */
const within = (box: DOMRect | undefined, { x, y }: Point) =>
  box !== undefined && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom

/** The title of the Tile of this id, as the canvas draws it. */
const titleIn = (hexes: Hexes, id: string) =>
  hexes.flatMap((hex) => (hex.kind === 'tile' && hex.tile.id === id ? [hex.tile.title] : []))[0] ??
  ''

const still = { by: { x: 0, y: 0 }, glides: false }

type Hexes = ReturnType<typeof useCanvasState>['state']['hexes']

/**
 * Each Tile's mark, by its id: what the caller says of it, the part of the center's words the agent
 * tells of, and the chat pointing at it, or at a tile below it off the canvas, whose way it is. A tile
 * standing in a slot is drawn under its own id.
 */
function tileMarksOf(
  system: TileNode,
  hexes: Hexes,
  marks: CanvasMarks | undefined,
  center: string,
) {
  const pointed = marks?.pointed
  const drawn = new Set<string>()
  for (const hex of hexes) {
    if (hex.kind === 'tile' && hex.tile.reference === undefined) drawn.add(hex.tile.id)
    if (hex.kind === 'empty') {
      const standing = marks?.slot?.(hex.slot)
      if (standing !== undefined) drawn.add(standing.id)
    }
  }
  const way =
    pointed === undefined
      ? undefined
      : wayTo(pointed, pathTo(system, pointed), (id) => drawn.has(id))
  return (id: string): TileMark | undefined => {
    const told = marks?.told
    const mark =
      told !== undefined && id === center ? { ...marks?.tile?.(id), told } : marks?.tile?.(id)
    if (way?.id !== id) return mark
    return { ...mark, pointed: way.way ? 'way' : 'tile' }
  }
}

/** A Proposal's moves, each an arc from its Tile to the free slot it would land in, where both are drawn. */
function Arcs({ hexes, arcs }: { hexes: Hexes; arcs: CanvasMarks['arcs'] }) {
  if (arcs === undefined || arcs.length === 0) return null
  const centers = centersOf(hexes)
  return arcs.map(({ from, to }) => {
    const start = centers.get(from)
    const slot = hexes.find(
      (hex) =>
        hex.kind === 'empty' &&
        hex.slot.parent.id === to.parent &&
        hex.slot.direction === to.direction,
    )
    const heart = centers.get(to.parent)
    if (start === undefined || slot === undefined || heart === undefined) return null
    return (
      <Arc
        key={`${from}:${to.parent}:${String(to.direction)}`}
        from={start}
        to={slot.hex.center}
        radius={slot.hex.radius}
        around={heart}
      />
    )
  })
}

/** Where each Tile is drawn, by its id: its own hex, never a Reference to it. */
function centersOf(hexes: Hexes): Map<string, Point> {
  const centers = new Map<string, Point>()
  for (const hex of hexes) {
    if (hex.kind === 'tile' && hex.tile.reference === undefined) {
      centers.set(hex.tile.id, hex.hex.center)
    }
  }
  return centers
}

/**
 * Where the Tile on the move can land, as drawn, each by its hex's key: each free slot its caller
 * lands it in, each Tile it trades places with, within most of a hex of its heart; what a click on
 * it and a drop there do alike.
 */
function targetsOf(
  hexes: Hexes,
  { emptySlots, moving }: { emptySlots: CanvasProps['emptySlots']; moving: Moving },
): (Landing & { reach: number })[] {
  return hexes.flatMap((hex) => {
    const at = { key: hex.key, center: hex.hex.center, reach: hex.hex.radius * 0.8 }
    if (hex.kind === 'empty') {
      const action = emptySlots?.(hex.slot)
      return action === undefined ? [] : [{ ...at, label: action.label, land: action.onSelect }]
    }
    if (hex.kind !== 'tile' || standsFor(hex, moving.id)) return []
    const swap = moving.swapTargets(hex.tile)
    if (swap === undefined) return []
    return [{ ...at, label: swap.label, partner: hex.tile.id, land: swap.onSelect }]
  })
}

/** What a click on a Tile does, as a screen reader hears it on its button. */
function actionLabel(action: TileAction, title: string): string {
  switch (action) {
    case 'expand':
      return m.hex_tile_expand({ title })
    case 'collapse':
      return m.hex_tile_collapse({ title })
    case 'center':
      return m.hex_tile_center({ title })
  }
}
