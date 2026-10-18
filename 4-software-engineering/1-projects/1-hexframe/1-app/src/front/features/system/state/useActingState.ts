// What acting on the System from the canvas does (HEX-105's menu, on home since HEX-107): each Tile's
// menu and each free slot's, a click on a free slot, and a move under way, its free slots and its
// swaps. A line that changes the URL opens a form, an import or the move there (`withChange`); one
// that writes sends its write at once, the change ending as it is sent: a Tile moved to a free place
// of its ring, swapped, turned into the other kind, a Reference removed, a delete once the dialog is
// confirmed. Share opens who may see the Tile in the chat, through the URL, as a form does. A copy goes
// to the clipboard, an export to the chat, and the agent's lines to the
// composer, which names the Tile first (HEX-110). Lines that go somewhere are the canvas's own. A refusal takes its channel, a toast, or brings the move back (`useRefusalState`).
import { useState } from 'react'

import { linkTo } from '#/domains/assistant/entities'
import {
  useDeleteReference,
  useDeleteTile,
  useMoveTile,
  useSwapTiles,
} from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import type { Acting, Moving } from '#/front/ui/canvas/Canvas'
import type { Direction } from '#/domains/mapping/entities'
import type { EmptySlotTarget } from '#/front/ui/canvas/geometry/shape'
import type { Action } from '#/front/ui/canvas/keys'
import type { TileHex } from '#/front/ui/canvas/state/useCanvasState'
import type { TileAct } from '#/front/ui/canvas/tile/menu/verbs'
import { findTile, type TileNode } from '#/front/ui/canvas/view/tiles'

import {
  addsAt,
  allows,
  framesOf,
  moveTo,
  movesHere,
  referenceAt,
  subjectOf,
  swapAt,
  tradeOf,
  turnOf,
  visitorsWithout,
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
import { copy } from '../copy'
import { slotOf, tileIn } from '../tree'
import { visitLinkOf } from '../visit/visit'
import type { Exported } from '../widget/state/useTileWidgetsState'
import { tilesBelow } from '../widget/place'

interface ActingInput {
  systems: Systems
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  /** Exports a Tile, which the chat shows. */
  exporting: { start: (exported: Exported) => void; pending: boolean }
  /**
   * Asks the agent through the chat: about a Tile, or, with the place, for a new one under it there,
   * the composer naming it first.
   */
  onAsk: (tile: string, place?: Direction) => void
}

/** A delete asked for from a Tile's menu, waiting on its dialog. */
interface Deleting {
  title: string
  /** How many Tiles go with it. */
  below: number
  confirm: () => void
  cancel: () => void
}

/** The move a Leaf takes to grow into a Branch before a Tile goes under it; none for any other. */
const growing = (systems: Systems, hex: TileHex) =>
  hex.tile.leaf === true ? turnOf(systems, tileIn(systems.root, hex.tile.id)) : undefined

/** The slot an empty Direction stands for, for an import or the moving one; none takes no click. */
function placeOf(target: EmptySlotTarget, going?: TileNode) {
  const slot = slotOf(target.ring, target.direction, going)
  return slot === undefined ? undefined : { parent: target.parent.id, slot }
}

/**
 * The slot a new Tile takes where the user clicked: a Leaf in a ring of Children, which grows into a
 * Branch once a Tile goes under it; else the slot the ring stands for, a Branch past six Children.
 */
function newTileOf(target: EmptySlotTarget) {
  const place = placeOf(target)
  if (place === undefined || target.ring !== 'children') return place
  return { ...place, slot: { leaf: target.direction } }
}

/**
 * What each of Copy's lines copies of a Tile: the link it is visited by, which leads whoever may
 * read it there, in the page's language (`visitLinkOf`); its title; the mention a Message links it
 * by (Assistant's `linkTo`).
 */
const copied = {
  'copy-link': ({ id }: TileNode) => visitLinkOf(id, location.href),
  'copy-title': ({ title }: TileNode) => title,
  'copy-mention': ({ id }: TileNode) => linkTo(id),
}

export function useActingState(input: ActingInput) {
  const { systems, search, onSearchChange, exporting, onAsk } = input
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
      case 'add': {
        // A new Tile is a Leaf; under a Leaf, which grows into a Branch first, in its queue before it.
        const grown = growing(systems, hex)
        if (grown !== undefined) move.mutate(grown)
        begin({ kind: 'add', parent: hex.tile.id, slot: { leaf: at } })
        return
      }
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
        const turned = turnOf(systems, tileIn(root, id))
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
      case 'share':
        begin({ kind: 'share', id })
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
      case 'ask-agent':
        onAsk(id)
        return
      default:
        // Open, Go in, Show its Context and Back out are the canvas's.
        return
    }
  }

  /**
   * A click on a free slot, or New tile here: the new Tile's form, for that slot; none where the
   * user's rights hold it back.
   */
  const addHere = (target: EmptySlotTarget): Action | undefined => {
    const place = newTileOf(target)
    if (place === undefined || !addsAt(systems, place)) return undefined
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

  /**
   * A free slot's menu: a new Tile there, an import into it, or the agent asked for one; none where
   * the user's rights hold it back, and on a System visited, a new Tile alone, an import and the
   * agent starting from home.
   */
  const slotActing = (target: EmptySlotTarget): Acting | undefined => {
    const place = placeOf(target)
    if (place === undefined || !addsAt(systems, place)) return undefined
    const fresh = newTileOf(target) ?? place
    return {
      subject: { kind: 'slot', at: target.direction, parent: target.parent.title },
      ...(systems.reach !== 'owned' && { without: visitorsWithout }),
      onAct: ({ verb }) => {
        if (verb === 'new-tile') begin({ kind: 'add', ...fresh })
        if (verb === 'import') begin({ kind: 'import', place: { _tag: 'Slot', ...place } })
        if (verb === 'ask-agent') onAsk(target.parent.id, target.direction)
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
    ...movingOf({ systems, search, begin, sent, move, swap, addHere }),
  }
}

interface MovingInput {
  systems: Systems
  search: SystemSearch
  begin: (change: Change) => void
  sent: () => void
  move: ReturnType<typeof useMoveTile>
  swap: ReturnType<typeof useSwapTiles>
  addHere: (target: EmptySlotTarget) => Action | undefined
}

/**
 * The move under way, the URL's: the Tile on the move, its free slots and its swaps, each sending
 * its write and ending the move as it is sent; a drag starting one, Escape or Stop ending it. A move
 * whose Tile is gone, deleted from another tab or an old link, is no move: the free slots add a Tile;
 * nor is one of a Tile the user's rights on a System visited keep where it is (`movesHere`).
 */
function movingOf(input: MovingInput) {
  const { systems, search, begin, sent, move, swap, addHere } = input
  const change = changeOf(search)
  const tile =
    change.kind === 'move' && movesHere(systems, change.id)
      ? findTile(systems.tree, change.id)
      : undefined
  const moveHere = (going: TileNode) => (target: EmptySlotTarget) => {
    const place = placeOf(target, going)
    const moved = place === undefined ? undefined : allows(systems, going.id, place)
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
    const swapped = tradeOf(systems, going, held)
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
