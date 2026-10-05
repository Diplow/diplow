// What the centered Tile's card shows and offers as a Child of its kind: a Leaf that isn't Markdown
// shows its Body as code, its Title its file's name; a Leaf grows into a Branch, and a Branch with
// nothing below it shrinks into a Leaf. Mapping has no operation for either: each is a move to the
// same Direction of the other kind (`useMoveTile`), refused `DirectionTaken`, in a toast, when a Tile
// of that kind already stands there. The card renders this and calls the action, nothing more.
import { isVerbatim } from '#/api/mapping/files/download'
import { type SystemTile, useMoveTile } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { directions, type Direction } from '#/front/ui/hex/geometry/geometry'

import { holdsNothing, tileIn } from '../tree'

/** A Tile changing kind in its own Direction: its button's name, whether it is on its way, the act. */
export interface KindChange {
  readonly label: string
  readonly pending: boolean
  readonly change: () => void
}

interface CenteredTileState {
  /** The Body to show as code: a Leaf's that isn't Markdown, none for any other Tile. */
  readonly code: string | undefined
  /** Grow a Leaf, or shrink a Branch with nothing below it; none for any other Tile. */
  readonly kindChange: KindChange | undefined
}

/** The centered Tile's card, by the Tile's id, against the System it stands in. */
export function useCenteredTileState(system: SystemTile, id: string): CenteredTileState {
  const move = useMoveTile()
  const child = childOf(system, id)
  if (child === undefined) return { code: undefined, kindChange: undefined }
  const { parent, direction } = child
  const act = (label: string, slot: Direction | { leaf: Direction }): KindChange => ({
    label,
    pending: move.isPending,
    change: () => {
      // One write at a time: a second press while the first is on its way does nothing.
      if (!move.isPending) move.mutate({ id, parent: parent.id, slot })
    },
  })
  if (child.kind === 'leaf')
    return {
      code: isVerbatim(child.tile) ? child.tile.body : undefined,
      kindChange: act(m.system_grow(), direction),
    }
  return {
    code: undefined,
    kindChange: holdsNothing(child.tile) ? act(m.system_shrink(), { leaf: direction }) : undefined,
  }
}

type Child =
  | { kind: 'leaf'; tile: NonNullable<SystemTile['leaves'][Direction]> }
  | { kind: 'branch'; tile: SystemTile }

/**
 * Where a Child of the System stands: the Tile it stands under, its Direction, and its kind with the
 * Tile itself. `undefined` for the Root, a Context Tile and an id no Tile has, none of which is a
 * Child.
 */
function childOf(
  system: SystemTile,
  id: string,
): (Child & { parent: SystemTile; direction: Direction }) | undefined {
  const parent = tileIn(system, id)?.parent
  if (parent === undefined) return undefined
  for (const direction of directions) {
    const leaf = parent.leaves[direction]
    if (leaf?.id === id) return { kind: 'leaf', tile: leaf, parent, direction }
    const branch = parent.branches[direction]
    if (branch?.id === id) return { kind: 'branch', tile: branch, parent, direction }
  }
  return undefined
}
