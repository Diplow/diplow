// What a refused write to the System puts back. A change ends the moment its write is sent, as if the
// write had landed: a form closes, a move or a swap ends, a delete centers the Tile it stood under. When
// the write is refused, by the server or foreseen, the change that was under way comes back, in the URL
// of that moment: a create's or an edit's form reopens with what the user typed and the refusal on the
// field it names (any other is in its toast already), a move or a swap is under way again. A delete
// puts nothing back: the Tile shows again where it stood, the System no longer folding the write, and
// the view stays where it is. Nor does a Tile's change of kind, which was no change in the URL. A
// change the user has under way meanwhile, a form or a move, is theirs: the refusal leaves it be, and
// shows in a toast.
// The components send their writes and change the URL; none of them handles a write's settle.
import { useState } from 'react'

import {
  type FoundTile,
  isLeafSlot,
  type PlacedTile,
  type Slot,
  tileAt,
} from '#/domains/mapping/entities'
import type { MoveTile } from '#/domains/mapping/operations'
import type { FormErrors } from '#/front/client/channels'
import { type Refused, type TileContent, useSystemRefusals } from '#/front/client/mapping/queries'

import {
  changeOf,
  keyOf,
  withChange,
  type Change,
  type SearchChange,
  type SystemSearch,
} from '../search/search'
import { movingIn } from '../tree'

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

/**
 * Puts back, on the URL of the moment each refusal arrives, the change its write ended, while the
 * System's page is open and no change is under way; off it, or over a change the user has under way,
 * a form or a move, a refusal shows in a toast alone.
 * Answers the form the last refusal reopened while the change under way is still that form's: once
 * the URL leaves it, closed, sent again or replaced, it is let go, and the same slot opens blank.
 */
export function useRefusalState(
  search: SystemSearch,
  onSearchChange: (change: SearchChange) => void,
): Reopened | undefined {
  const under = changeOf(search)
  const key = keyOf(under)
  const [reopened, setReopened] = useState<Reopened>()
  // The change under way at the last render: when the URL leaves a reopened form, it is let go.
  const [seen, setSeen] = useState(key)
  if (key !== seen) {
    setSeen(key)
    if (reopened !== undefined && keyOf(reopened.change) !== key) setReopened(undefined)
  }
  useSystemRefusals((refused) => {
    const back = changeBack(refused)
    if (back === undefined || under.kind !== 'none') return false
    setReopened(
      'content' in back ? { turn: refused.turn, ...back, shown: refused.shown } : undefined,
    )
    onSearchChange((current) => withChange(current, back.change))
    return true
  })
  return reopened !== undefined && keyOf(reopened.change) === key ? reopened : undefined
}

/** The change a refused write puts back, with the form's content for a form's write. */
type Back =
  | { change: Extract<Change, { kind: 'add' | 'edit' }>; content: TileContent }
  | { change: Extract<Change, { kind: 'move' }> }

/** What a refused Operation puts back in the URL; nothing for one that ended no change there. */
function changeBack({ operation, system }: Refused): Back | undefined {
  const held = (id: string) => (system === undefined ? undefined : tileAt(system, id))
  switch (operation._tag) {
    case 'CreateTile': {
      const { parent, slot, title, preview, body } = operation
      return { change: { kind: 'add', parent, slot }, content: { title, preview, body } }
    }
    case 'EditTile': {
      // The form held every field; the edit sent those that changed, the others are the Tile's.
      const tile = held(operation.id)
      if (tile === undefined) return undefined
      const { title = tile.title, preview = tile.preview, body = tile.body } = operation
      return { change: { kind: 'edit', id: operation.id }, content: { title, preview, body } }
    }
    case 'MoveTile': {
      // A Tile gone has nothing to move, and a change of kind was sent from the card, no move.
      const tile = held(operation.id)
      if (tile === undefined || changesKind(tile, operation)) return undefined
      return { change: { kind: 'move', id: operation.id } }
    }
    case 'SwapTiles': {
      const moving = movingIn(operation)
      return held(moving) === undefined ? undefined : { change: { kind: 'move', id: moving } }
    }
    case 'DeleteTile':
    case 'CreateReference':
    case 'DeleteReference':
      return undefined
  }
}

/**
 * Whether a move makes a Leaf of a Branch or a Branch of a Leaf, as Mapping has a Tile change kind: a
 * move to the same Direction of the same parent, of the other kind. A grow or a shrink, sent from the
 * card; a move under way never makes one, its slots keeping the moving Tile's kind (`slotOf`), or
 * taking it into a Context.
 */
const changesKind = (tile: FoundTile | PlacedTile, move: MoveTile) =>
  'slot' in tile && tile.parent === move.parent && otherKindOf(tile.slot, move.slot)

/** Whether two slots are one Direction, a Leaf's and a Branch's. */
const otherKindOf = (a: Slot, b: Slot) =>
  isLeafSlot(a) ? b === a.leaf : isLeafSlot(b) && a === b.leaf
