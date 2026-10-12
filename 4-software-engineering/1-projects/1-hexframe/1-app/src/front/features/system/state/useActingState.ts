// What acting on the System from the canvas does (HEX-105's menu, on home since HEX-107): each Tile's
// menu and each free slot's, a click on a free slot, and a move under way, its free slots and its
// swaps. A line that changes the URL opens a form, an import or the move there (`withChange`); one
// that writes sends its write at once, the change ending as it is sent: a Tile moved to a free place
// of its ring, swapped, turned into the other kind, a Reference removed, a delete once the dialog is
// confirmed. A copy goes to the clipboard, an export to the chat. Lines that go somewhere are the
// canvas's own. A refusal takes its channel, a toast, or brings the move back (`useRefusalState`).
import { useState } from 'react'

import { tileLink } from '#/api/mapping/files/download'
import { linkTo } from '#/domains/assistant/entities'
import {
  useDeleteReference,
  useDeleteTile,
  useMoveTile,
  useSwapTiles,
} from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import { localizeUrl } from '#/paraglide/runtime'
import { toast } from '#/front/ui/atoms/Toaster'
import type { Acting, Moving } from '#/front/ui/canvas/Canvas'
import type { EmptySlotTarget } from '#/front/ui/canvas/geometry/shape'
import type { Action } from '#/front/ui/canvas/keys'
import type { TileHex } from '#/front/ui/canvas/state/useCanvasState'
import type { TileAct } from '#/front/ui/canvas/tile/menu/verbs'
import { findTile, type TileNode } from '#/front/ui/canvas/view/tiles'

import {
  framesOf,
  moveTo,
  referenceAt,
  subjectOf,
  swapAt,
  tradeOf,
  turnOf,
  waiting,
  withoutOf,
  type Systems,
} from '../acting'
import {
  afterDelete,
  changeOf,
  withChange,
  type Change,
  type SearchChange,
  type SystemSearch,
} from '../search/search'
import { moveOf, slotOf, tileIn } from '../tree'
import type { Exported } from '../widget/state/useTileWidgetsState'
import { tilesBelow } from '../widget/place'

interface ActingInput {
  systems: Systems
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  /** Exports a Tile, which the chat shows. */
  exporting: { start: (exported: Exported) => void; pending: boolean }
}

/** A delete asked for from a Tile's menu, waiting on its dialog. */
interface Deleting {
  title: string
  /** How many Tiles go with it. */
  below: number
  confirm: () => void
  cancel: () => void
}

/** Copies `text`, saying so; without a secure context there is no clipboard, which fails alike. */
function copy(text: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast(m.system_copied()),
    () => toast.error(m.system_copy_failed()),
  )
}

/** The slot an empty Direction stands for, for a new Tile or the moving one; none takes no click. */
function placeOf(target: EmptySlotTarget, going?: TileNode) {
  const slot = slotOf(target.ring, target.direction, going)
  return slot === undefined ? undefined : { parent: target.parent.id, slot }
}

/**
 * What each of Copy's lines copies of a Tile: the link to home centered on it, in the page's
 * language; its title; the mention a Message links it by (Assistant's `linkTo`).
 */
const copied = {
  'copy-link': ({ id }: TileNode) => localizeUrl(tileLink(location.href)(id)).href,
  'copy-title': ({ title }: TileNode) => title,
  'copy-mention': ({ id }: TileNode) => linkTo(id),
}

export function useActingState({ systems, search, onSearchChange, exporting }: ActingInput) {
  const move = useMoveTile()
  const swap = useSwapTiles()
  const remove = useDeleteTile()
  const unlink = useDeleteReference()
  const [deleting, setDeleting] = useState<TileNode>()
  const { root, flat, tree } = systems
  const begin = (change: Change) => {
    onSearchChange(withChange(search, change))
  }
  // A write ends the move as it is sent, as if it had landed; a refusal brings it back.
  const sent = () => {
    onSearchChange((current) => withChange(current, { kind: 'none' }))
  }

  /** A line that picked a place in a frame: a new Tile there, the Tile moved there, or swapped. */
  function actAt(hex: TileHex, { verb, at }: Extract<TileAct, { at: unknown }>) {
    switch (verb) {
      case 'add':
        begin({ kind: 'add', parent: hex.tile.id, slot: at })
        return
      case 'move': {
        const moved = moveTo(systems, hex, at)
        if (moved !== undefined) move.mutate(moved)
        return
      }
      case 'swap': {
        const swapped = swapAt(systems, hex, at)
        if (swapped !== undefined) swap.mutate(swapped)
      }
    }
  }

  /** What a chosen line of a Tile's menu does, beyond going somewhere. */
  function act(hex: TileHex, chosen: TileAct) {
    if ('at' in chosen) {
      actAt(hex, chosen)
      return
    }
    const { id, title } = hex.tile
    switch (chosen.verb) {
      case 'edit':
        begin({ kind: 'edit', id })
        return
      case 'make-leaf':
      case 'make-branch': {
        // Shown at once, offering the change back: a second one while the first is on its way would
        // undo it, so it waits.
        const turned = turnOf(flat, tileIn(root, id))
        if (turned !== undefined && !move.isPending) move.mutate(turned)
        return
      }
      case 'move-elsewhere':
        begin({ kind: 'move', id })
        return
      case 'copy-link':
      case 'copy-title':
      case 'copy-mention':
        copy(copied[chosen.verb](hex.tile))
        return
      case 'export':
        // One export at a time, as the chat shows one.
        if (!exporting.pending)
          exporting.start({ tile: { id, title }, below: tilesBelow(flat, id) })
        return
      case 'delete':
        setDeleting(hex.tile)
        return
      case 'remove-reference': {
        const slot = referenceAt(systems, hex)
        if (slot !== undefined) unlink.mutate(slot)
        return
      }
      case 'import':
        begin({ kind: 'import', place: { _tag: 'Root' } })
        return
      default:
        // Open, Go in, Show its Context and Back out are the canvas's; the agent's is left out.
        return
    }
  }

  /** A click on a free slot, or New tile here: the new Tile's form, for that slot. */
  const addHere = (target: EmptySlotTarget): Action | undefined => {
    const place = placeOf(target)
    if (place === undefined) return undefined
    const labels = {
      children: m.system_add_child,
      branches: m.system_add_child,
      leaves: m.system_add_leaf,
      context: m.system_add_context,
    }
    return {
      label: labels[target.ring]({ title: target.parent.title }),
      onSelect: () => {
        begin({ kind: 'add', ...place })
      },
    }
  }

  /** A free slot's menu: a new Tile there, an import into it. */
  const slotActing = (target: EmptySlotTarget): Acting | undefined => {
    const place = placeOf(target)
    if (place === undefined) return undefined
    return {
      subject: { kind: 'slot', at: target.direction, parent: target.parent.title },
      without: waiting,
      onAct: ({ verb }) => {
        if (verb === 'new-tile') begin({ kind: 'add', ...place })
        if (verb === 'import') begin({ kind: 'import', place: { _tag: 'Slot', ...place } })
      },
    }
  }

  const deleteOf = (gone: TileNode): Deleting | undefined => {
    const found = tileIn(root, gone.id)
    if (found?.parent === undefined) return undefined
    const { version } = found.tile
    const parent = found.parent.id
    return {
      title: gone.title,
      below: tilesBelow(flat, gone.id),
      confirm: () => {
        setDeleting(undefined)
        remove.mutate({ id: gone.id, version })
        // As the widget's delete does: the Tile it stood under centered, a change under way that
        // named it ended.
        onSearchChange(afterDelete(tree, parent, gone))
      },
      cancel: () => {
        setDeleting(undefined)
      },
    }
  }

  return {
    acting: {
      tile: (hex: TileHex): Acting | undefined => {
        const subject = subjectOf(systems, hex)
        if (subject === undefined) return undefined
        return {
          subject,
          frames: framesOf(systems, hex),
          without: withoutOf(systems, hex),
          onAct: (chosen) => {
            act(hex, chosen)
          },
        }
      },
      slot: slotActing,
    },
    deleting: deleting === undefined ? undefined : deleteOf(deleting),
    ...movingOf({ tree, search, flat, begin, sent, move, swap, addHere }),
  }
}

interface MovingInput {
  tree: TileNode
  search: SystemSearch
  flat: Systems['flat']
  begin: (change: Change) => void
  sent: () => void
  move: ReturnType<typeof useMoveTile>
  swap: ReturnType<typeof useSwapTiles>
  addHere: (target: EmptySlotTarget) => Action | undefined
}

/**
 * The move under way, the URL's: the Tile on the move, its free slots and its swaps, each sending
 * its write and ending the move as it is sent; a drag starting one, Escape or Stop ending it. A move
 * whose Tile is gone, deleted from another tab or an old link, is no move: the free slots add a Tile.
 */
function movingOf({ tree, search, flat, begin, sent, move, swap, addHere }: MovingInput) {
  const change = changeOf(search)
  const tile = change.kind === 'move' ? findTile(tree, change.id) : undefined
  const moveHere = (going: TileNode) => (target: EmptySlotTarget) => {
    const place = placeOf(target, going)
    const moved = place === undefined ? undefined : moveOf(flat, going.id, place)
    if (moved === undefined) return undefined
    const names = { tile: going.title, title: target.parent.title }
    return {
      label: target.ring === 'context' ? m.system_move_context(names) : m.system_move_child(names),
      onSelect: () => {
        move.mutate(moved)
        sent()
      },
    }
  }
  const swapWith = (going: TileNode) => (held: TileNode) => {
    const swapped = tradeOf(flat, going, held)
    return swapped !== undefined
      ? {
          label: m.system_swap_with({ title: held.title }),
          onSelect: () => {
            swap.mutate(swapped)
            sent()
          },
        }
      : undefined
  }
  const moving: Moving | undefined =
    tile === undefined ? undefined : { id: tile.id, title: tile.title, swapTargets: swapWith(tile) }
  return {
    emptySlots: tile === undefined ? addHere : moveHere(tile),
    move: {
      moving,
      start: (id: string) => {
        begin({ kind: 'move', id })
      },
      stop: () => {
        begin({ kind: 'none' })
      },
    },
  }
}
