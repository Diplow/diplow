// The canvas's state, as it draws it: the view the URL holds resolved against the System, its hexes,
// and what each gesture asks of the view. The view itself stays the URL's: every action hands the
// next one to `onViewChange`, for the route to navigate to, with the gesture that asked for it and the
// Tile it was made on. What it holds is the motion between two views: what an opened hex holds, the
// center's ring included, blooms out of its heart, and folds back into it for `--duration-fold` before
// the view that closes it is handed on, at once with reduced motion. Under a finger, a tap on a Branch
// of the ring goes in, opening it in place waiting in its menu; the menu's lines that go somewhere,
// open, go in, show the Context, back out, are gestures too. Where its caller holds a Tile's click or
// its going in back, that gesture does nothing there.
import { useEffect, useRef, useState } from 'react'

import { directions, type Point } from '../geometry/geometry'
import { layoutCanvas, type CanvasHex } from '../geometry/shape'
import type { TileMotion } from '../tile/Tile'
import { movingFor } from '../../motion'
import { firstKindOf, pathTo, type TileNode } from '../view/tiles'
import {
  centerOn,
  showView,
  toggleCenter,
  toggleExpanded,
  withContext,
  type CanvasView,
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
 * What a Tile lets through of the gestures made on it: its click, Enter and Space, and its menu's
 * Open (`click`); and moving the center from it (`recenter`), a click that would center it, going
 * into it by a double click, Shift+Enter or its menu's Go in, centering it with its Context by Show
 * its Context, or its menu's Back out.
 */
export interface TileLets {
  click: boolean
  recenter: boolean
}

/**
 * A canvas with rules of its own, the tutorial's, as its caller hands them on: the view it shows,
 * each Tile's menu, the view's lines alone (`looking`), and what each Tile lets through.
 */
export interface CanvasRules {
  view: CanvasView
  looking: boolean
  lets: (hex: TileHex) => TileLets
}

/** Every gesture let through, as on any canvas whose caller holds none back. */
const everything: TileLets = { click: true, recenter: true }

/** What a gesture on a Tile asks of the view: a click's, or its menu's Show its Context. */
type TileGesture = TileAction | 'show-context'

/**
 * What a click on `hex` does in `shown`; nothing on a centered Leaf, which opens nothing. A finger has
 * no double click to go in with: its tap on a Branch of the ring goes in, rather than opening it.
 */
function tileAction(hex: TileHex, shown: ShownView, finger = false): TileAction | undefined {
  // The untitled root, its lamp alone, is not there yet: a click on it does nothing.
  if (hex.tile.root === 'untitled' || hex.tile.root === 'empty') return undefined
  switch (hex.role) {
    case 'center':
      if (shown.frame !== undefined) return 'collapse'
      return firstKindOf(shown.center) === undefined ? undefined : 'expand'
    case 'hub':
      return 'collapse'
    case 'branch':
      // Only the ring around the center opens its Branches; theirs are a generation further.
      return hex.generation === 1 && !finger ? 'expand' : 'center'
    case 'leaf':
    case 'context':
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
}

export function useCanvasState(input: CanvasInput) {
  const { system, view, onViewChange, finger = false, lets = () => everything } = input
  const shown = showView(system, view)
  const hexes = layoutCanvas(shown)
  const { inside, hubs } = openedIn(hexes)
  // The hex the last single click landed on: a double-click centers its Tile only if its first click
  // landed there too, since that click may have redrawn what lies under the pointer.
  const clicked = useRef<string | undefined>(undefined)
  // The ground whose six fold back into its heart, and the view handed on once they have.
  const [folding, setFolding] = useState<string>()
  const fold = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(fold.current)
    },
    [],
  )
  // The view as it stands, which a fold checks before handing its own on: a view changed meanwhile,
  // by a link or the browser's Back, gives the fold up rather than being overwritten. And the
  // caller's latest `onViewChange`, which the fold hands its view to, so what else the page changed
  // meanwhile, its search params beside the view, is kept.
  const viewNow = JSON.stringify(view)
  const latest = useRef({ view: viewNow, onViewChange })
  useEffect(() => {
    latest.current = { view: viewNow, onViewChange }
  })

  const change = (next: CanvasView, gesture: Gesture, tile: string) => {
    latest.current.onViewChange(next, { gesture, tile })
  }

  /** Centers the Tile of this id, a fold under way given up for it. */
  function centerTile(tile: string, context = false) {
    clearTimeout(fold.current)
    setFolding(undefined)
    const centered = centerOn(system, tile)
    if (context) change(withContext(system, centered), 'show-context', tile)
    else change(centered, 'center', tile)
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
        change(centerOn(system, tile), action, tile)
    }
  }

  /**
   * Closes the hex `hex` sits at the heart of, or folds the center, once what it holds has folded
   * back into it, at once when nothing moves, unless the view changed meanwhile.
   */
  function foldThen(hex: TileHex, action: TileAction) {
    const ground = hex.role === 'center' ? ring : hubs.get(hex.key)
    const duration = movingFor('--duration-fold')
    if (ground === undefined || duration === 0) {
      act(hex, action)
      return
    }
    setFolding(ground)
    fold.current = setTimeout(() => {
      setFolding(undefined)
      if (latest.current.view === viewNow) act(hex, action)
    }, duration)
  }

  /**
   * What a click on `hex` does, by a pointer or a finger; nothing where its click is held back, nor
   * a centering where moving the center is.
   */
  const actionOf = (hex: TileHex, hand = finger) => {
    const { click, recenter } = lets(hex)
    const action = click ? tileAction(hex, shown, hand) : undefined
    return action === 'center' && !recenter ? undefined : action
  }

  return {
    state: {
      center: shown.center,
      hexes,
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
        return folding === ring || at.ground === folding
          ? { way: 'fold', from: at.from }
          : { way: 'bloom', from: at.from, order: at.order }
      },
      /** A click, Enter or Space on `hex`, a tap under a finger; none while a fold is under way. */
      click: (hex: TileHex) => {
        press(hex, actionOf(hex))
      },
      /** A double-click, or Shift+Enter, on `hex`, a fold under way given up for it. */
      center: (hex: TileHex, from: 'pointer' | 'keyboard') => {
        const again = from === 'keyboard' || clicked.current === hex.key
        if (!again || hex.tile.id === shown.center.id || !lets(hex).recenter) return
        centerTile(hex.tile.id)
      },
      /**
       * A line of `hex`'s menu that goes somewhere. Open does what a pointer's click does, a Branch
       * of the ring opening in place under a finger too; Go in centers it; Show its Context centers
       * it with its Context inside, or shows the center's; Back out centers the Tile the center
       * stands under.
       */
      go: (hex: TileHex, verb: ViewVerb) => {
        const tile = hex.tile.id
        const centered = tile === shown.center.id
        const { recenter } = lets(hex)
        switch (verb) {
          case 'open':
            press(hex, actionOf(hex, false))
            return
          case 'go-in':
            if (!centered && recenter) centerTile(tile)
            return
          case 'show-context':
            if (!centered && recenter) centerTile(tile, true)
            else if (centered && shown.inner !== 'context') act(hex, 'show-context')
            return
          case 'back-out': {
            const parent = pathTo(system, shown.center.id).at(-2)
            if (parent !== undefined && recenter) centerTile(parent.id)
          }
        }
      },
    },
  }
}
