// What a refused write to the System puts back. A change ends the moment its write is sent, as if the
// write had landed: a form closes, a move or a swap ends, a delete centers the Tile it stood under. When
// the write is refused, by the server or foreseen, the change that was under way comes back, in the URL
// of that moment: a create's or an edit's form reopens with what the user typed and the refusal on the
// field it names (any other is in its toast already), a move or a swap is under way again. A delete
// puts nothing back: the Tile shows again where it stood, the System no longer folding the write, and
// the view stays where it is. Nor does a Tile's change of kind, which was no change in the URL.
// The components send their writes and change the URL; none of them handles a write's settle.
import { useState } from 'react'

import { type FoundTile, isLeafSlot, type PlacedTile, tileAt } from '#/domains/mapping/entities'
import type { MoveTile } from '#/domains/mapping/operations'
import type { FormErrors } from '#/front/client/channels'
import { type Refused, type TileContent, useSystemRefusals } from '#/front/client/mapping/queries'

import { withChange, type Change, type SearchChange } from '../search/search'

/** A Tile's form reopened by its write's refusal, with what the user typed in it. */
export interface Reopened {
  /** The refused write's turn: the form opens afresh for each refusal. */
  readonly turn: number
  /** The change the form is open for, a new Tile's in its slot or a Tile's edit. */
  readonly change: Extract<Change, { kind: 'add' | 'edit' }>
  /** What the user typed, the form's Title, Preview and Body. */
  readonly content: TileContent
  /** What the form shows of the refusal. */
  readonly shown: FormErrors
}

interface RefusalState {
  /** The form the last refusal reopened, until it is sent again or closed; none for any other. */
  readonly reopened: Reopened | undefined
  /** Lets the reopened form go: it was sent again, or closed. */
  readonly forget: () => void
}

/**
 * Puts back, on the URL of the moment each refusal arrives, the change its write ended, while the
 * System's page is open. Off it, a refusal shows in its toast alone.
 */
export function useRefusalState(onSearchChange: (change: SearchChange) => void): RefusalState {
  const [reopened, setReopened] = useState<Reopened>()
  useSystemRefusals((refused) => {
    const back = changeBack(refused)
    if (back === undefined) return
    // A move under way again closes any form, so a form reopened before it is let go.
    setReopened(
      'content' in back ? { turn: refused.turn, ...back, shown: refused.shown } : undefined,
    )
    onSearchChange((current) => withChange(current, back.change))
  })
  return {
    reopened,
    forget: () => {
      setReopened(undefined)
    },
  }
}

/** The change a refused write puts back, with the form's content for a form's write. */
type Back =
  | { change: Extract<Change, { kind: 'add' | 'edit' }>; content: TileContent }
  | { change: Extract<Change, { kind: 'move' }> }

/** What a refused Operation puts back in the URL; nothing for one that ended no change there. */
function changeBack({ operation, system }: Refused): Back | undefined {
  switch (operation._tag) {
    case 'CreateTile': {
      const { parent, slot, title, preview, body } = operation
      return { change: { kind: 'add', parent, slot }, content: { title, preview, body } }
    }
    case 'EditTile': {
      // The form held every field; the edit sent those that changed, the others are the Tile's.
      const tile = system === undefined ? undefined : tileAt(system, operation.id)
      if (tile === undefined) return undefined
      const { title = tile.title, preview = tile.preview, body = tile.body } = operation
      return { change: { kind: 'edit', id: operation.id }, content: { title, preview, body } }
    }
    case 'MoveTile': {
      // A Tile gone has nothing to move, and a change of kind was sent from the card, no move.
      const tile = system === undefined ? undefined : tileAt(system, operation.id)
      if (tile === undefined || changesKind(tile, operation)) return undefined
      return { change: { kind: 'move', id: operation.id } }
    }
    case 'SwapTiles':
      // The moving Tile is the one a swap names first (`System.tsx`).
      return { change: { kind: 'move', id: operation.a } }
    case 'DeleteTile':
    case 'CreateReference':
    case 'DeleteReference':
      return undefined
  }
}

/**
 * Whether a move makes a Leaf of a Branch or a Branch of a Leaf: a grow or a shrink, sent from the
 * card. A move under way never does, its slots keeping the moving Tile's kind (`slotOf`).
 */
const changesKind = (tile: FoundTile | PlacedTile, move: MoveTile) =>
  'slot' in tile && isLeafSlot(tile.slot) !== isLeafSlot(move.slot)
