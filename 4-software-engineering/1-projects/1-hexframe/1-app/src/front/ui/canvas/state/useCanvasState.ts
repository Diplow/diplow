// The canvas's state, as it draws it: the view the URL holds resolved against the System, its hexes,
// and what each gesture asks of the view. The view itself stays the URL's: every action hands the
// next one to `onViewChange`, for the route to navigate to, with the gesture that asked for it and the
// Tile it was made on. Centering moves the camera alone, every Tile keeping the state it is drawn in
// (`recenter`). What it holds is the motion between two views: what a hex opened in place holds, the
// center's ring included, blooms out of its heart, once, as it comes, never as the camera brings it,
// and folds back into it for `--duration-fold` before the view that closes it is handed on, at once
// with reduced motion. Under a finger, a tap on a Branch
// of the ring goes in, opening it in place waiting in its menu; the menu's lines that go somewhere,
// open, go in, show the center's Context, back out, are gestures too, and so is the C key, which
// cycles the center's views. Where its caller holds a Tile's click or its going in back, that gesture
// does nothing there.
import { useEffect, useRef, useState } from 'react'

import { directions, type Point } from '../geometry/geometry'
import { heartShare, layoutCanvas, surroundingsOf, type CanvasHex } from '../geometry/shape'
import type { TileMotion } from '../tile/Tile'
import { movingFor } from '../../motion'
import { pathTo, type TileNode } from '../view/tiles'
import {
  aboveOf,
  cycleOf,
  opens,
  recenter,
  showView,
  toggleCenter,
  toggleExpanded,
  withContext,
  withoutEmptyRings,
  type CanvasView,
  type Fills,
  type Gesture,
  type ShownView,
  type ViewAction,
} from '../view/view'

/** A hex holding a Tile, which a click acts on. */
export type TileHex = Extract<CanvasHex, { kind: 'tile' }>

/**
 * What a click on a Tile does: the center opens into its ring, or folds back alone; a Branch of the
 * ring around it opens, or closes once open; anything else is centered, having nothing to open at
 * depth 2. A double-click, or Shift+Enter, centers any Tile but the center.
 */
export type TileAction = Extract<Gesture, 'expand' | 'collapse' | 'center'>

/**
 * What a Tile lets through of the gestures made on it: its click, Enter and Space, its menu's Open
 * and, on the center, the C key (`click`); and moving the center from it (`recenter`), a click that
 * would center it, going into it by a double click, Shift+Enter or its menu's Go in, or its menu's
 * Back out.
 */
export interface TileLets {
  click: boolean
  recenter: boolean
}

/**
 * How a canvas only looked at shows each Tile, past its words: its menu, the view's lines alone,
 * beside its hover card (`menu`); its hover card alone (`card`); or neither (`false`).
 */
export type Looking = 'menu' | 'card' | false

/**
 * A canvas with rules of its own, the tutorial's, as its caller hands them on: the view it shows, how
 * each Tile is looked at (`looking`), what each Tile lets through, and whether it introduces opening
 * its center (`introducesOpening`).
 */
export interface CanvasRules {
  view: CanvasView
  looking: Looking
  lets: (hex: TileHex) => TileLets
  /**
   * Opening the center is introduced: where a click would open it, the center invites that click,
   * and its six arrive one by one (HEX-121).
   */
  introducesOpening: boolean
}

/** Every gesture let through, as on any canvas whose caller holds none back. */
const everything: TileLets = { click: true, recenter: true }

/** What a gesture on a Tile asks of the view: a click's, or its menu's Show its Context. */
type TileGesture = TileAction | 'show-context'

/** How a click is decided: by a finger or not, and which Tiles the reader may add to. */
interface Deciding {
  finger: boolean
  fills: Fills
}

/**
 * What a click on `hex` does in `shown`; nothing on a centered Tile that opens nothing, a Leaf, or
 * one holding nothing the reader may add to (`opens`), which a Branch of the ring is centered for
 * instead. A finger has no double click to go in with: its tap on a Branch of the ring goes in,
 * rather than opening it.
 */
/** The untitled root, its lamp alone, and an empty System's: not there yet, nothing on it answers. */
const unborn = (hex: TileHex) => hex.tile.root === 'untitled' || hex.tile.root === 'empty'

function tileAction(hex: TileHex, shown: ShownView, how: Deciding): TileAction | undefined {
  if (unborn(hex)) return undefined
  switch (hex.role) {
    case 'center':
      if (shown.frame !== undefined) return 'collapse'
      return opens(shown.center, how.fills) ? 'expand' : undefined
    case 'hub':
      return 'collapse'
    case 'branch':
      // Only the ring around the center opens its Branches; theirs are a generation further.
      return hex.generation === 1 && !how.finger && opens(hex.tile, how.fills) ? 'expand' : 'center'
    case 'leaf':
    case 'context':
    case 'above':
    case 'beside':
      return 'center'
  }
}

/** A hex drawn inside a hex opened in place: the ground it stands on, its heart, its turn among its six. */
interface Inside {
  ground: string
  from: Point
  order: number
}

/** The lines of a tile's menu that go somewhere: the view's, which the canvas runs itself. */
const viewVerbs = ['open', 'go-in', 'show-context', 'back-out'] as const

export type ViewVerb = (typeof viewVerbs)[number]

/** Whether a menu's line is the view's to run. */
export const isViewVerb = (verb: string): verb is ViewVerb =>
  (viewVerbs as readonly string[]).includes(verb)

/**
 * What folds back into the center as it folds: every hex of its ring and what they hold, keyed apart
 * from any ground, since the center's ring stands around its hex, not inside it.
 */
const ring = 'ring'

/**
 * Where each hex stands among the hexes opened in place: by key, the ground of each Tile or free slot
 * drawn inside one, and of each in the ring around the center, the center's own `ring` (`inside`);
 * and the ground of each Tile drawn at its heart (`hubs`).
 */
function openedIn(hexes: readonly CanvasHex[]) {
  const inside = new Map<string, Inside>()
  const hubs = new Map<string, string>()
  for (const ground of hexes) {
    if (ground.kind !== 'ground') continue
    for (const hex of hexes) {
      const at = standing(hex, ground)
      if (at === 'heart') hubs.set(hex.key, ground.key)
      else if (at !== undefined) inside.set(hex.key, at)
    }
  }
  for (const [key, at] of centerRing(hexes, inside)) inside.set(key, at)
  return { inside, hubs }
}

/**
 * The hexes of the ring around the center, which bloom out of its heart and fold back into it: those
 * of the first generation in a Direction, but the ones inside its hex, which its ground holds.
 */
function centerRing(hexes: readonly CanvasHex[], inside: ReadonlyMap<string, Inside>) {
  const center = hexes.find((hex) => hex.kind === 'tile' && hex.role === 'center')
  const around = new Map<string, Inside>()
  if (center === undefined) return around
  for (const hex of hexes) {
    const direction = directionOf(hex)
    if (hex.generation !== 1 || inside.has(hex.key) || direction === undefined) continue
    around.set(hex.key, {
      ground: ring,
      from: center.hex.center,
      order: directions.indexOf(direction),
    })
  }
  return around
}

/** The Direction a Tile or a free slot stands in; none for the center, a ground or a list. */
function directionOf(hex: CanvasHex) {
  if (hex.kind === 'tile') return hex.direction
  return hex.kind === 'empty' ? hex.slot.direction : undefined
}

/**
 * Where `hex` stands on a ground: a Tile at its heart, or a Tile or a free slot inside it, within its
 * radius, a generation further, in a Direction of its ring; or neither.
 */
function standing(hex: CanvasHex, ground: CanvasHex): 'heart' | Inside | undefined {
  if (hex.kind !== 'tile' && hex.kind !== 'empty') return undefined
  const from = ground.hex.center
  const away = Math.hypot(hex.hex.center.x - from.x, hex.hex.center.y - from.y)
  if (away < 1e-6) return hex.kind === 'tile' ? 'heart' : undefined
  const direction = hex.kind === 'tile' ? hex.direction : hex.slot.direction
  if (direction === undefined || hex.generation <= ground.generation) return undefined
  if (away >= ground.hex.radius) return undefined
  return { ground: ground.key, from, order: directions.indexOf(direction) }
}

interface CanvasInput {
  /** The System's root Tile, with everything below it. */
  system: TileNode
  view: CanvasView
  /** The next view, and the gesture that asked for it on which Tile. */
  onViewChange: (view: CanvasView, action: ViewAction) => void
  /** The hand is a finger (`pointer-coarse`): its tap on a Branch of the ring goes in. */
  finger?: boolean
  /** What each Tile lets through of the gestures on it; without it, every one. */
  lets?: ((hex: TileHex) => TileLets) | undefined
  /**
   * Whether the reader may add to a Tile, a free slot of its ring taking a new Tile: one holding
   * nothing they may not add to opens nothing (`opens`). Without it, they may add to every one.
   */
  fills?: Fills | undefined
}

/**
 * The ground whose six fold back into its heart, `folding`, while they do and until the view that
 * closes it lands, so they stay folded meanwhile: `start`, a fold of that ground for
 * `--duration-fold`, then what it hands on, at once where nothing moves, the fold given up should it
 * hand nothing on; `stop`, a fold under way given up. A view that changes otherwise ends it too.
 */
function useFolding(viewNow: string) {
  const [fold, setFold] = useState<{ ground: string; view: string }>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )
  // A fold kept from a view since left is over: Back to that view must not find it folding.
  if (fold !== undefined && fold.view !== viewNow) setFold(undefined)
  return {
    folding: fold?.view === viewNow ? fold.ground : undefined,
    start(ground: string | undefined, then: () => boolean) {
      const duration = movingFor('--duration-fold')
      if (ground === undefined || duration === 0) {
        then()
        return
      }
      setFold({ ground, view: viewNow })
      timer.current = setTimeout(() => {
        if (!then()) setFold(undefined)
      }, duration)
    },
    stop() {
      clearTimeout(timer.current)
      setFold(undefined)
    },
  }
}

/** Whether a drawn Tile stands opened, at the heart of its ring: the center opened, or a hub. */
const standsOpened = (hex: CanvasHex) =>
  hex.kind === 'tile' && (hex.role === 'hub' || (hex.role === 'center' && hex.alone !== true))

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((key) => b.has(key))

/** What the canvas drew last, by key, as `useArrivals` keeps it. */
interface Arrived {
  center: string
  tiles: ReadonlySet<string>
  opened: ReadonlySet<string>
  framing: Framing
  folding: ReadonlySet<string>
  blooms: ReadonlyMap<string, boolean>
  grown: ReadonlyMap<string, number>
}

/**
 * How the center is framed: alone, folded; opened, a ring around it; or inside the hex it opens into,
 * a ring inside it, its tile a heart's share of that hex.
 */
type Framing = 'alone' | 'opened' | 'inside'

function framingOf(hexes: readonly CanvasHex[]): Framing {
  const center = hexes.find((hex): hex is TileHex => hex.kind === 'tile' && hex.role === 'center')
  if (center === undefined || center.alone === true) return 'alone'
  const inside = hexes.some(
    (hex) => hex.kind === 'ground' && hex.key === `ground:${center.tile.id}`,
  )
  return inside ? 'inside' : 'opened'
}

/**
 * How much larger each Tile was drawn, as the world goes, by key, where it opened or folded as the
 * camera moved: one opened or folded as the center changed, going out a level, which the camera
 * carries by the heart of each; and the center itself, framed by the hex it opens into on one side
 * of a flight and by its own on the other, as it folds from its Context or opens into it from alone.
 */
function grownOf(
  seen: Arrived,
  center: string,
  now: Omit<Arrived, 'blooms' | 'grown' | 'center' | 'folding'>,
) {
  if (seen.center !== center) {
    return new Map(
      [...now.tiles].flatMap((key): [string, number][] => {
        if (!seen.tiles.has(key) || seen.opened.has(key) === now.opened.has(key)) return []
        return [[key, seen.opened.has(key) ? heartShare : 1 / heartShare]]
      }),
    )
  }
  const inside = (framing: Framing) => framing === 'inside'
  const key = `tile:${center}`
  if (inside(seen.framing) !== inside(now.framing) && now.tiles.has(key)) {
    return new Map([[key, inside(seen.framing) ? heartShare : 1 / heartShare]])
  }
  return sameSet(seen.opened, now.opened) && seen.framing === now.framing
    ? seen.grown
    : new Map<string, number>()
}

/**
 * How each hex drawn came, by key. Whether one inside a hex opened in place blooms (`blooms`): one
 * that comes while the center stays, as a hex opens in place, does, once; one the camera brings, as
 * the center changes, does not, nor one whose fold was given up, which plays back to rest instead
 * (`tile/settle.ts`); each keeps its answer while it stays drawn, so a bloom never plays again as the
 * view changes around it. And how much larger a Tile was drawn, as the world goes, where it opened
 * or folded as the camera moved (`grownOf`), which it settles from, until the next change.
 */
function useArrivals(
  center: string,
  hexes: readonly CanvasHex[],
  inside: ReadonlyMap<string, Inside>,
  folding: string | undefined,
) {
  const now = {
    tiles: new Set(hexes.flatMap((hex) => (hex.kind === 'tile' ? [hex.key] : []))),
    opened: new Set(hexes.flatMap((hex) => (standsOpened(hex) ? [hex.key] : []))),
    framing: framingOf(hexes),
  }
  const foldingNow = new Set(
    [...inside].flatMap(([key, at]) => (folding === ring || at.ground === folding ? [key] : [])),
  )
  const [seen, setSeen] = useState<Arrived>(() => ({
    center,
    ...now,
    folding: foldingNow,
    blooms: new Map([...inside.keys()].map((key) => [key, true])),
    grown: new Map(),
  }))
  const moved = seen.center !== center
  const blooms = new Map(
    [...inside.keys()].map((key) => {
      const givenUp = seen.folding.has(key) && !foldingNow.has(key)
      return [key, !givenUp && (seen.blooms.get(key) ?? !moved)]
    }),
  )
  const grown = grownOf(seen, center, now)
  const same =
    grown === seen.grown &&
    seen.framing === now.framing &&
    sameSet(seen.tiles, now.tiles) &&
    sameSet(seen.folding, foldingNow) &&
    blooms.size === seen.blooms.size &&
    [...blooms].every(([key, blooms]) => seen.blooms.get(key) === blooms)
  if (!same) setSeen({ center, ...now, folding: foldingNow, blooms, grown })
  return { blooms, grown }
}

export function useCanvasState(input: CanvasInput) {
  const { system, view, onViewChange, finger = false, lets = () => everything } = input
  const { fills = () => true } = input
  const shown = withoutEmptyRings(showView(system, view), fills)
  const hexes = layoutCanvas(shown)
  const centered = hexes.find((hex): hex is TileHex => hex.kind === 'tile' && hex.role === 'center')
  const { inside, hubs } = openedIn(hexes)
  // The hex the last single click landed on: a double-click centers its Tile only if its first click
  // landed there too, since that click may have redrawn what lies under the pointer.
  const clicked = useRef<string | undefined>(undefined)
  // The view as it stands, which a fold checks before handing its own on: a view changed meanwhile,
  // by a link or the browser's Back, gives the fold up rather than being overwritten. And the
  // caller's latest `onViewChange`, which the fold hands its view to, so what else the page changed
  // meanwhile, its search params beside the view, is kept.
  const viewNow = JSON.stringify(view)
  const { folding, ...folds } = useFolding(viewNow)
  const { blooms, grown } = useArrivals(shown.center.id, hexes, inside, folding)
  const latest = useRef({ view: viewNow, onViewChange })
  useEffect(() => {
    latest.current = { view: viewNow, onViewChange }
  })

  const change = (next: CanvasView, gesture: Gesture, tile: string) => {
    latest.current.onViewChange(next, { gesture, tile })
  }

  /** Centers the Tile of this id, every Tile keeping its state, a fold under way given up for it. */
  function centerTile(tile: string) {
    folds.stop()
    change(recenter(system, view, tile), 'center', tile)
  }

  /** A click, Enter or Space on `hex`, or what its menu's Open does without a finger's turn. */
  function press(hex: TileHex, action: TileAction | undefined) {
    if (folding !== undefined) return
    clicked.current = hex.key
    if (action === undefined) return
    if (action === 'collapse') foldThen(hex, action)
    else act(hex, action)
  }

  function act(hex: TileHex, action: TileGesture) {
    const tile = hex.tile.id
    switch (action) {
      case 'expand':
      case 'collapse':
        if (hex.role === 'center') change(toggleCenter(system, view), action, tile)
        else if (hex.direction !== undefined)
          change(toggleExpanded(system, view, hex.direction), action, tile)
        return
      case 'show-context':
        change(withContext(system, view), action, tile)
        return
      case 'center':
        change(recenter(system, view, tile), action, tile)
    }
  }

  /**
   * Closes the hex `hex` sits at the heart of, or folds the center, once what it holds has folded
   * back into it, at once when nothing moves, unless the view changed meanwhile.
   */
  function foldThen(hex: TileHex, action: TileAction) {
    folds.start(hex.role === 'center' ? ring : hubs.get(hex.key), () => {
      if (latest.current.view !== viewNow) return false
      act(hex, action)
      return true
    })
  }

  /**
   * What a click on `hex` does, by a pointer or a finger; nothing where its click is held back, nor
   * a centering where moving the center is.
   */
  const actionOf = (hex: TileHex, hand = finger) => {
    const through = lets(hex)
    const action = through.click ? tileAction(hex, shown, { finger: hand, fills }) : undefined
    return action === 'center' && !through.recenter ? undefined : action
  }

  /**
   * The Tiles around the drawing, the one the center stands in and those beside it, each opened as
   * the view says with what it opens into: none where moving the center from them is held back.
   */
  function aroundOf(): CanvasHex[] {
    const above = aboveOf(system, shown)
    if (above === undefined || centered === undefined) return []
    const hexes = surroundingsOf(withoutEmptyRings(above, fills), centered, shown.around)
    const held = hexes.some((hex) => hex.kind === 'tile' && (unborn(hex) || !lets(hex).recenter))
    return held ? [] : hexes
  }

  return {
    state: {
      center: shown.center,
      hexes,
      // The Tile the center stands in and those beside it, with what they open into, around the
      // drawing, where a click on a Tile centers it: none where moving the center is held back.
      around: aroundOf(),
    },
    actions: {
      actionOf: (hex: TileHex) => actionOf(hex),
      /**
       * How a hex drawn inside one opened in place, or in the center's ring, moves: blooming out of
       * its heart, after its elder siblings, or folding back into it, all of them as the center
       * folds; none for the others.
       */
      motionOf: (key: string): TileMotion | undefined => {
        const at = inside.get(key)
        if (at === undefined) return undefined
        if (folding === ring || at.ground === folding) return { way: 'fold', from: at.from }
        return blooms.get(key) === true
          ? { way: 'bloom', from: at.from, order: at.order }
          : undefined
      },
      /**
       * How much larger a Tile was drawn, as the world goes, where it opened or folded as the camera
       * moved, which it settles from; none for the others.
       */
      grownOf: (key: string) => grown.get(key),
      /** A click, Enter or Space on a Tile around the drawing, or going into it: centers it. */
      around: (hex: TileHex) => {
        if (hex.tile.id !== shown.center.id && lets(hex).recenter) centerTile(hex.tile.id)
      },
      /** A click, Enter or Space on `hex`, a tap under a finger; none while a fold is under way. */
      click: (hex: TileHex) => {
        press(hex, actionOf(hex))
      },
      /**
       * The C key: the center's next view (`cycleOf`), alone, opened into its ring, its Context
       * inside too, then alone again, folding as a click folds it; none where its click is held,
       * nor on a Root not there yet, which nothing answers on.
       */
      cycle: () => {
        const hex = hexes.find(
          (each): each is TileHex => each.kind === 'tile' && each.role === 'center',
        )
        const held = hex === undefined || unborn(hex) || !lets(hex).click
        const step = held ? undefined : cycleOf(shown, fills)
        if (hex === undefined || step === undefined || folding !== undefined) return
        if (step === 'collapse') foldThen(hex, step)
        else act(hex, step)
      },
      /** A double-click, or Shift+Enter, on `hex`, a fold under way given up for it. */
      center: (hex: TileHex, from: 'pointer' | 'keyboard') => {
        const again = from === 'keyboard' || clicked.current === hex.key
        if (!again || hex.tile.id === shown.center.id || !lets(hex).recenter) return
        centerTile(hex.tile.id)
      },
      /**
       * A line of `hex`'s menu that goes somewhere. Open does what a pointer's click does, a Branch
       * of the ring opening in place under a finger too; Go in centers it; Show its Context shows
       * the center's, the one Tile that shows its Context; Back out centers the Tile the center
       * stands under.
       */
      go: (hex: TileHex, verb: ViewVerb) => {
        const tile = hex.tile.id
        const centered = tile === shown.center.id
        switch (verb) {
          case 'open':
            press(hex, actionOf(hex, false))
            return
          case 'go-in':
            if (!centered && lets(hex).recenter) centerTile(tile)
            return
          case 'show-context':
            // The center's alone: another Tile is gone into first.
            if (centered && shown.inner !== 'context') act(hex, 'show-context')
            return
          case 'back-out': {
            const parent = pathTo(system, shown.center.id).at(-2)
            if (parent !== undefined && lets(hex).recenter) centerTile(parent.id)
          }
        }
      },
    },
  }
}
