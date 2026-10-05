// What the centered Tile's card shows and offers as a Child of its kind: a Leaf that isn't Markdown
// shows its Body as code, its Title its file's name; a Leaf grows into a Branch, and a Branch with
// nothing below it shrinks into a Leaf. Mapping has no operation for either: each is a move to the
// same Direction of the other kind (`useMoveTile`), refused `DirectionTaken`, in a toast, when a Tile
// of that kind already stands there. The card renders this and calls the action, nothing more.
import { isVerbatim } from '#/api/mapping/files/download'
import { holdsNothing } from '#/api/mapping/rules'
import { type SystemTile, useMoveTile } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import type { Direction } from '#/front/ui/hex/geometry/geometry'

import { tileIn } from '../tree'

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
  const found = tileIn(system, id)
  const act = (
    parent: SystemTile,
    label: string,
    slot: Direction | { leaf: Direction },
  ): KindChange => ({
    label,
    pending: move.isPending,
    change: () => {
      // One write at a time: a second press while the first is on its way does nothing.
      if (!move.isPending) move.mutate({ id, parent: parent.id, slot })
    },
  })
  switch (found?.kind) {
    case 'leaf':
      return {
        code: isVerbatim(found.tile) ? found.tile.body : undefined,
        kindChange: act(found.parent, m.system_grow(), found.direction),
      }
    case 'branch':
      return {
        code: undefined,
        kindChange: holdsNothing(found.tile)
          ? act(found.parent, m.system_shrink(), { leaf: found.direction })
          : undefined,
      }
    default:
      // The Root and a Context Tile are no Child, and an id no Tile has is nothing to act on.
      return { code: undefined, kindChange: undefined }
  }
}
