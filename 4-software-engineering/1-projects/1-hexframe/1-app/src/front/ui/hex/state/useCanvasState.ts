// The canvas's state, as it draws it: the view the URL holds resolved against the System, its hexes,
// the rings the center can show, and what each gesture asks of the view. The view itself stays the
// URL's: every action hands the next one to `onViewChange`, for the route to navigate to.
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
  type ShownView,
} from '../view/view'

/** A hex holding a Tile, which a click acts on. */
export type TileHex = Extract<CanvasHex, { kind: 'tile' }>

/**
 * What a click on a Tile does: the center shows its Context, or hides the ring inside it; a Branch
 * of the ring around it opens, or closes once open; anything else is centered, having nothing to
 * open at depth 2. A double-click, or Shift+Enter, centers any Tile but the center.
 */
export type TileAction =
  'expand' | 'collapse' | 'show-context' | 'hide-context' | 'hide-leaves' | 'center'

const hiding: Record<InnerKind, TileAction> = { context: 'hide-context', leaves: 'hide-leaves' }

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
  onViewChange: (view: CanvasView) => void
}

export function useCanvasState({ system, view, onViewChange }: CanvasInput) {
  const shown = showView(system, view)
  // The hex the last single click landed on: a double-click centers its Tile only if its first click
  // landed there too, since that click may have redrawn what lies under the pointer.
  const clicked = useRef<string | undefined>(undefined)

  function act(hex: TileHex, action: TileAction) {
    switch (action) {
      case 'expand':
      case 'collapse':
        if (hex.direction !== undefined) onViewChange(toggleExpanded(system, view, hex.direction))
        return
      case 'show-context':
        onViewChange(withInner(system, view, 'context'))
        return
      case 'hide-context':
      case 'hide-leaves':
        onViewChange(withInner(system, view, undefined))
        return
      case 'center':
        onViewChange(centerOn(system, hex.tile.id))
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
        if (again && hex.tile.id !== shown.center.id) onViewChange(centerOn(system, hex.tile.id))
      },
      showAround: (kind: OuterKind) => {
        onViewChange(withFrame(system, view, kind))
      },
      showInside: (kind: InnerKind | undefined) => {
        onViewChange(withInner(system, view, kind))
      },
    },
  }
}
