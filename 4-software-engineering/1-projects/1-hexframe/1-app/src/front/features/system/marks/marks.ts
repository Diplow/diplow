// Who touches a Tile on home's canvas, as HEX-108 drew it on the canvas's own pieces (ui's
// `tile/marks/`), built in HEX-109: the chat pointing at a Tile, lighting it or its way; a Tile the chat
// centered, glinting as the canvas arrives; the agent's light running round the Tile its Turn works
// in; a change the agent or a Key made since the page opened, glinting once as it comes, then a dot
// until the user opens the Tile, and those the user's own acceptance of a Proposal made glinting in
// their amber; and an open Proposal, its creates standing as ghosts in their slots, its edits, moves
// and deletions on the Tiles' rims, each move its arc. And what a Tile named in the chat says in its
// card, as the canvas's card says it. Pure: `useMarksState` holds what changes.
import type { Entry } from '#/domains/assistant/entities'
import {
  type Direction,
  isContextSlot,
  isLeafSlot,
  type Slot,
  type System,
} from '#/domains/mapping/entities'
import { m } from '#/paraglide/messages'
import type { CanvasMarks, SlotStanding } from '#/front/ui/canvas/Canvas'
import type { By, TileMark } from '#/front/ui/canvas/tile/marks/mark'
import { placeOf, type Subject } from '#/front/ui/canvas/tile/menu/verbs'
import type { MentionProps } from '#/front/ui/chat/text/Mention'

import { standsFor } from '../tree'
import type { Proposed } from './proposal'

/** A light rising once on a Tile, in the colour of who touched it, `key` rising it again. */
export interface Glint {
  readonly id: string
  readonly key: string
}

/** A change made to a Tile since the page opened: who made it, and the Entry that tells it. */
export interface Touch {
  readonly tile: string
  readonly by: By
  readonly key: string
}

/**
 * The Tiles the user's acceptance of a Proposal changed: those of each accepted Proposal not undone
 * that the page saw open (`watched`), as its Entry names them.
 */
export function acceptedOf(
  entries: ReadonlyArray<Entry>,
  watched: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set(
    entries.flatMap((entry) =>
      entry._tag === 'Proposal' &&
      entry.fate === 'accepted' &&
      entry.undone !== true &&
      watched.has(entry.proposal)
        ? entry.changes.flatMap(({ tile, other }) => [tile.id, ...(other ? [other.id] : [])])
        : [],
    ),
  )
}

/**
 * The changes to the System recorded since the page read today first (`known`, the Entries it held
 * then), by the agent or a Key, each Tile they name touched; the user's own are left out, but those
 * their acceptance of a Proposal made, recorded as the agent's, which are theirs (`accepted`).
 */
export function touchesOf(
  entries: ReadonlyArray<Entry>,
  { known, accepted }: { known: ReadonlySet<string>; accepted: ReadonlySet<string> },
): Touch[] {
  return entries.flatMap((entry) => {
    if (entry._tag !== 'Change' || known.has(entry.id) || entry.actor._tag === 'You') return []
    const tiles = [entry.tile.id, ...(entry.other === undefined ? [] : [entry.other.id])]
    return tiles.map((tile): Touch => {
      const by: By = entry.actor._tag === 'Key' ? 'key' : accepted.has(tile) ? 'human' : 'agent'
      return { tile, by, key: entry.id }
    })
  })
}

/** What the canvas marks on home, as the page holds it. */
export interface Marking {
  /** The Tile the chat points at, by its id. */
  readonly pointed?: string | undefined
  /** The Tile the chat just centered. */
  readonly arrived?: Glint | undefined
  /** The Tile the running Turn works in, its location. */
  readonly working?: string | undefined
  /** The changes made since the page opened, oldest first. */
  readonly touches?: ReadonlyArray<Touch>
  /** The Entries of the changes the user opened the Tile of since. */
  readonly opened?: ReadonlySet<string>
  /** What the open Proposal would do. */
  readonly proposed?: Proposed | undefined
}

/** The Direction a slot stands in under its parent: a Context slot's, negated. */
function directionOf(slot: Slot): Direction {
  if (isLeafSlot(slot)) return slot.leaf
  return (isContextSlot(slot) ? -slot : slot) as Direction
}

/** A Tile's mark from what the page holds, none when nothing touches it. */
function tileMarkOf(marking: Marking, id: string): TileMark | undefined {
  const { arrived, working, touches = [], opened, proposed } = marking
  const last = touches.findLast((touch) => touch.tile === id)
  const unseen = touches.findLast(
    (touch) => touch.tile === id && touch.by !== 'human' && opened?.has(touch.key) !== true,
  )
  const glint =
    arrived?.id === id
      ? { by: 'human' as const, key: arrived.key }
      : last && { by: last.by, key: last.key }
  const change = proposed?.changes.get(id)
  const mark: TileMark = {
    ...(working === id && { working: true }),
    ...(glint && { glint }),
    ...(unseen && unseen.by !== 'human' && { unseen: unseen.by }),
    ...(change && { proposed: change }),
  }
  return Object.keys(mark).length === 0 ? undefined : mark
}

/**
 * Who touches what home's canvas draws: each Tile's mark, the Tile the chat points at, each ghost of
 * the open Proposal in the free slot it would take, and each of its moves an arc to where it lands.
 */
export function canvasMarksOf(marking: Marking): CanvasMarks {
  const { pointed, proposed } = marking
  const ghosts = [...(proposed?.ghosts ?? [])]
  return {
    tile: (id) => tileMarkOf(marking, id),
    pointed,
    slot: ({ parent, ring, direction }): SlotStanding | undefined => {
      const ghost = ghosts.find(
        ([, at]) => at.parent === parent.id && standsFor(ring, direction, at.slot),
      )
      if (ghost === undefined) return undefined
      const [id, { title, preview }] = ghost
      return { id, look: { kind: 'ghost', words: { title, preview } } }
    },
    arcs: [...(proposed?.moves ?? [])].map(([from, to]) => ({
      from,
      to: { parent: to.parent, direction: directionOf(to.slot) },
    })),
  }
}

/** A Title as the chat and the canvas say it: an untitled Tile, the Root before its name, "Untitled". */
const named = (title: string) => (title === '' ? m.system_untitled() : title)

/** A Tile's kind and place, by its slot under its parent. */
function seated(slot: Slot, parent: string): Subject {
  const kind = isContextSlot(slot) ? 'context' : isLeafSlot(slot) ? 'leaf' : 'branch'
  return { kind, title: '', at: directionOf(slot), parent }
}

/**
 * What a Tile named in the chat says in its card, as the canvas's card says it: its kind and place,
 * and its Preview; for a Tile the open Proposal would create, where it would stand. None for a Tile
 * neither holds, nor for a Reference, which no name in the chat stands for.
 */
export function cardOf(
  system: System,
  proposed: Proposed | undefined,
  id: string,
): MentionProps['card'] {
  const titleOf = (tile: string) => {
    const held = tile === system.root.id ? system.root : system.tiles[tile]
    return named((held?._tag === 'Tile' ? held.title : proposed?.ghosts.get(tile)?.title) ?? '')
  }
  const described = (preview: string) => (preview === '' ? {} : { description: preview })
  if (id === system.root.id) {
    const { title, preview } = system.root
    const kind = title === '' ? 'untitled' : 'root'
    return { place: placeOf({ kind, title, at: 'center' }), ...described(preview) }
  }
  const tile = system.tiles[id]
  if (tile?._tag === 'Tile') {
    return { place: placeOf(seated(tile.slot, titleOf(tile.parent))), ...described(tile.preview) }
  }
  const ghost = proposed?.ghosts.get(id)
  if (ghost === undefined) return undefined
  return { place: placeOf(seated(ghost.slot, titleOf(ghost.parent))), ...described(ghost.preview) }
}
