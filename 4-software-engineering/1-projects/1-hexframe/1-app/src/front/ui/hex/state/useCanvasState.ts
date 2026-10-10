// The canvas's state, as it draws it: the view the URL holds resolved against the System, its hexes,
// the rings the center can show, and what each gesture asks of the view. The view itself stays the
// URL's: every action hands the next one to `onViewChange`, for the route to navigate to, with the
// gesture that asked for it and the Tile it was made on.
import { useRef } from 'react'

import { layoutCanvas, type CanvasHex } from '../geometry/shape'
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

interface CanvasInput {
  /** The System's root Tile, with everything below it. */
  system: TileNode
  view: CanvasView
  /** The next view, and the gesture that asked for it on which Tile. */
  onViewChange: (view: CanvasView, action: ViewAction) => void
}

export function useCanvasState({ system, view, onViewChange }: CanvasInput) {
  const shown = showView(system, view)
  // The hex the last single click landed on: a double-click centers its Tile only if its first click
  // landed there too, since that click may have redrawn what lies under the pointer.
  const clicked = useRef<string | undefined>(undefined)

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

  return {
    state: {
      center: shown.center,
      hexes: layoutCanvas(shown),
      /** The rings shown around and inside the center, and the kinds it could show instead. */
      rings: { around: shown.frame, inside: shown.inner, choices: ringChoices(shown) },
    },
    actions: {
      actionOf: (hex: TileHex) => tileAction(hex, shown),
      /** A click, Enter or Space on `hex`. `repeat` is the second click of a double-click. */
      click: (hex: TileHex, repeat: boolean) => {
        // The second click of a double-click is the double-click's, not a click of its own.
        if (repeat) return
        clicked.current = hex.key
        const action = tileAction(hex, shown)
        if (action !== undefined) act(hex, action)
      },
      /** A double-click, or Shift+Enter, on `hex`. */
      center: (hex: TileHex, from: 'pointer' | 'keyboard') => {
        const again = from === 'keyboard' || clicked.current === hex.key
        if (again && hex.tile.id !== shown.center.id)
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
