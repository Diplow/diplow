// The canvas's state, as it draws it: the view the URL holds resolved against the System, its hexes,
// the rings the center can show, and what each gesture asks of the view. The view itself stays the
// URL's: every action hands the next one to `onViewChange`, for the route to navigate to, with the
// gesture that asked for it and the Tile it was made on. What it holds is the motion between two
// views: what an opened hex holds blooms out of its heart, and folds back into it for
// `--duration-fold` before the view that closes it is handed on, at once with reduced motion.
import { useEffect, useRef, useState } from 'react'

import { directions, type Point } from '../geometry/geometry'
import { layoutCanvas, type CanvasHex } from '../geometry/shape'
import type { TileMotion } from '../tile/Tile'
import { movingFor } from './motion'
import type { InnerKind, OuterKind, TileNode } from '../view/tiles'
import {
  centerOn,
  ringChoices,
  showView,
  toggleExpanded,
  withFrame,
  withInner,
  type CanvasView,
  type Gesture,
  type ShownView,
  type ViewAction,
} from '../view/view'

/** A hex holding a Tile, which a click acts on. */
export type TileHex = Extract<CanvasHex, { kind: 'tile' }>

/**
 * What a click on a Tile does: the center shows its Context, or hides the ring inside it; a Branch
 * of the ring around it opens, or closes once open; anything else is centered, having nothing to
 * open at depth 2. A double-click, or Shift+Enter, centers any Tile but the center.
 */
export type TileAction = Extract<
  Gesture,
  'expand' | 'collapse' | 'show-context' | 'hide-context' | 'hide-leaves' | 'center'
>

const hiding: Record<InnerKind, TileAction> = { context: 'hide-context', leaves: 'hide-leaves' }
const showing: Record<InnerKind, Gesture> = { context: 'show-context', leaves: 'show-leaves' }
const around: Record<OuterKind, Gesture> = {
  children: 'show-children-around',
  branches: 'show-branches-around',
  leaves: 'show-leaves-around',
}

/** The gesture that shows `kind` inside the center, or hides the ring `inner` shown there; none for no change. */
function insideGesture(kind: InnerKind | undefined, inner: InnerKind | undefined) {
  if (kind !== undefined) return kind === inner ? undefined : showing[kind]
  return inner === undefined ? undefined : hiding[inner]
}

/** What a click on `hex` does in `shown`; nothing on a centered Leaf, which opens nothing. */
function tileAction(hex: TileHex, shown: ShownView): TileAction | undefined {
  switch (hex.role) {
    case 'center':
      if (shown.frame === undefined) return undefined
      return shown.inner === undefined ? 'show-context' : hiding[shown.inner]
    case 'hub':
      return 'collapse'
    case 'branch':
      // Only the ring around the center opens its Branches; theirs are a generation further.
      return hex.generation === 1 ? 'expand' : 'center'
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

/** The gestures that close an opened hex, whose six fold back into its heart first. */
const closing = new Set<TileAction>(['collapse', 'hide-context', 'hide-leaves'])

/**
 * Where each hex stands among the hexes opened in place: by key, the ground of each Tile or free slot
 * drawn inside one (`inside`), and the ground of each Tile drawn at its heart (`hubs`).
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
  return { inside, hubs }
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
}

export function useCanvasState({ system, view, onViewChange }: CanvasInput) {
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

  const change = (next: CanvasView, gesture: Gesture, tile: string) => {
    onViewChange(next, { gesture, tile })
  }

  function act(hex: TileHex, action: TileAction) {
    const tile = hex.tile.id
    switch (action) {
      case 'expand':
      case 'collapse':
        if (hex.direction !== undefined)
          change(toggleExpanded(system, view, hex.direction), action, tile)
        return
      case 'show-context':
        change(withInner(system, view, 'context'), action, tile)
        return
      case 'hide-context':
      case 'hide-leaves':
        change(withInner(system, view, undefined), action, tile)
        return
      case 'center':
        change(centerOn(system, tile), action, tile)
    }
  }

  /** Closes the hex `hex` sits at the heart of once its six have folded back, at once when nothing moves. */
  function foldThen(hex: TileHex, action: TileAction) {
    const ground = hubs.get(hex.key)
    const duration = movingFor('--duration-fold')
    if (ground === undefined || duration === 0) {
      act(hex, action)
      return
    }
    setFolding(ground)
    fold.current = setTimeout(() => {
      setFolding(undefined)
      act(hex, action)
    }, duration)
  }

  return {
    state: {
      center: shown.center,
      hexes,
      /** The rings shown around and inside the center, and the kinds it could show instead. */
      rings: { around: shown.frame, inside: shown.inner, choices: ringChoices(shown) },
    },
    actions: {
      actionOf: (hex: TileHex) => tileAction(hex, shown),
      /**
       * How a hex drawn inside one opened in place moves: blooming out of its heart, after its elder
       * siblings, or folding back into it; none for the others.
       */
      motionOf: (key: string): TileMotion | undefined => {
        const at = inside.get(key)
        if (at === undefined) return undefined
        return at.ground === folding
          ? { way: 'fold', from: at.from }
          : { way: 'bloom', from: at.from, order: at.order }
      },
      /** A click, Enter or Space on `hex`; none while a fold is under way. */
      click: (hex: TileHex) => {
        if (folding !== undefined) return
        clicked.current = hex.key
        const action = tileAction(hex, shown)
        if (action === undefined) return
        if (closing.has(action)) foldThen(hex, action)
        else act(hex, action)
      },
      /** A double-click, or Shift+Enter, on `hex`, a fold under way given up for it. */
      center: (hex: TileHex, from: 'pointer' | 'keyboard') => {
        const again = from === 'keyboard' || clicked.current === hex.key
        if (!again || hex.tile.id === shown.center.id) return
        clearTimeout(fold.current)
        setFolding(undefined)
        change(centerOn(system, hex.tile.id), 'center', hex.tile.id)
      },
      /** Picks the ring around the center; the one shown already changes nothing. */
      showAround: (kind: OuterKind) => {
        if (kind !== shown.frame)
          change(withFrame(system, view, kind), around[kind], shown.center.id)
      },
      /** Picks the ring inside the center, or none; the one shown already changes nothing. */
      showInside: (kind: InnerKind | undefined) => {
        const gesture = insideGesture(kind, shown.inner)
        if (gesture !== undefined) change(withInner(system, view, kind), gesture, shown.center.id)
      },
    },
  }
}
