// Who touches a Tile on home's canvas, as HEX-108 drew it on the canvas's own pieces (ui's
// `tile/marks/`), built in HEX-109: the chat pointing at a Tile, lighting it or its way; a Tile the chat
// centered, glinting as the canvas arrives; the agent's light running round the Tile its Turn works
// in; a change the agent or a Key made since the page opened, glinting once as it comes, then a dot
// until the user opens the Tile, and those the user's own acceptance of a Proposal made glinting in
// their amber; and an open Proposal, its creates standing as ghosts in their slots, its edits, moves
// and deletions on the Tiles' rims, each move its arc. And what a Tile named in the chat says in its
// card, as the canvas's card says it. Pure: `useMarksState` holds what changes.
import type { Entry } from '#/domains/assistant/entities'
import type { Direction, Slot, System } from '#/domains/mapping/entities'
import type { CanvasMarks, SlotStanding } from '#/front/ui/canvas/Canvas'
import type { By, TileMark } from '#/front/ui/canvas/tile/marks/mark'
import { placeOf, type Subject } from '#/front/ui/canvas/tile/menu/verbs'
import type { MentionProps } from '#/front/ui/chat/text/Mention'

import { standsFor, titleOf } from '../tree'
import { seatOf } from '../widget/place'
import type { Proposed } from './proposal'

/**
 * A Tile the chat centered, glinting in your amber as the canvas arrives, `key` the glint's own, so
 * another arrival rises it again; `lastEntry`, the last change to it the page held then, so a change
 * that comes later glints its own.
 */
export interface Arrival {
  readonly id: string
  readonly key: string
  readonly lastEntry?: string | undefined
}

/** A change made to a Tile since the page opened: who made it, and the Entry that tells it. */
export interface Touch {
  readonly tile: string
  readonly by: By
  readonly entry: string
}

/**
 * A change the user's acceptance of a Proposal made: the Proposal's Entry, by its place among
 * today's, and the change, by Mapping's verb and the Tile it names, as the Proposal drafted it.
 */
interface Landing {
  readonly proposalAt: number
  readonly change: string
}

/** A change, as a Proposal drafted it and as a Change Entry records it: its verb, then its Tile. */
const changeOf = ({ verb, tile }: { verb: string; tile: { id: string } }) => `${verb}:${tile.id}`

/**
 * The changes the user's acceptance made: each change of each accepted Proposal not undone that the
 * page saw open (`watched`), which the Change Entries recorded after its Entry answer one for one.
 */
export function acceptedOf(
  entries: ReadonlyArray<Entry>,
  watched: ReadonlySet<string>,
): ReadonlyArray<Landing> {
  return entries.flatMap((entry, proposalAt) =>
    entry._tag === 'Proposal' &&
    entry.fate === 'accepted' &&
    entry.undone !== true &&
    watched.has(entry.proposal)
      ? entry.changes.map((change) => ({ proposalAt, change: changeOf(change) }))
      : [],
  )
}

/**
 * The changes to the System recorded since the page read today first (`known`, the Entries it held
 * then), by the agent, a Key or someone else, each Tile they name touched, someone else's marked as a
 * Key's, from outside; the user's own are left out. A change
 * the user's acceptance of a Proposal made is recorded as the agent's: the first Change by the
 * Assistant after the Proposal's Entry that matches one of its changes is theirs (`accepted`), and
 * each of its changes is answered once, so a later change by the agent to the same Tile stays the
 * agent's.
 */
export function touchesOf(
  entries: ReadonlyArray<Entry>,
  { known, accepted }: { known: ReadonlySet<string>; accepted: ReadonlyArray<Landing> },
): Touch[] {
  const owed = [...accepted]
  return entries.flatMap((entry, at) => {
    if (entry._tag !== 'Change' || entry.actor._tag === 'You') return []
    const landed =
      entry.actor._tag === 'Assistant'
        ? owed.findIndex(({ proposalAt, change }) => proposalAt < at && change === changeOf(entry))
        : -1
    if (landed !== -1) owed.splice(landed, 1)
    if (known.has(entry.id)) return []
    // A Key and someone else alike come from outside the user and their agent.
    const outside = entry.actor._tag === 'Key' || entry.actor._tag === 'Someone'
    const by: By = outside ? 'key' : landed === -1 ? 'agent' : 'human'
    const tiles = [entry.tile.id, ...(entry.other === undefined ? [] : [entry.other.id])]
    return tiles.map((tile): Touch => ({ tile, by, entry: entry.id }))
  })
}

/** What the canvas marks on home, as the page holds it. */
export interface Marking {
  /** The Tile the chat points at, by its id. */
  readonly pointed?: string | undefined
  /** The Tile the chat just centered. */
  readonly arrived?: Arrival | undefined
  /** The Tile the running Turn works in, its location. */
  readonly working?: string | undefined
  /** The changes made since the page opened, oldest first. */
  readonly touches?: ReadonlyArray<Touch>
  /** The Entries of the changes the user opened the Tile of since. */
  readonly opened?: ReadonlySet<string>
  /**
   * The glints that have played, by their key: a light rises once, as its change comes or the chat
   * centers its Tile, and not again each time the Tile comes back into the view.
   */
  readonly played?: ReadonlySet<string>
  /** What the open Proposal would do. */
  readonly proposed?: Proposed | undefined
}

/** The Direction a slot stands in under its parent, as the tile widget reads it. */
const directionOf = (slot: Slot): Direction => seatOf(slot).place

/** A Tile's mark from what the page holds, none when nothing touches it. */
function tileMarkOf(marking: Marking, id: string): TileMark | undefined {
  const { arrived, working, touches = [], opened, played, proposed } = marking
  const last = touches.findLast((touch) => touch.tile === id)
  const unseen = touches.findLast(
    (touch): touch is Touch & { by: Exclude<By, 'human'> } =>
      touch.tile === id && touch.by !== 'human' && opened?.has(touch.entry) !== true,
  )
  // The newer of the arrival and the last change: one that comes after the arrival glints its own.
  const newest =
    arrived?.id === id && last?.entry === arrived.lastEntry
      ? { by: 'human' as const, key: arrived.key }
      : last && { by: last.by, key: last.entry }
  const glint = newest && played?.has(newest.key) !== true ? newest : undefined
  const change = proposed?.changes.get(id)
  const mark: TileMark = {
    ...(working === id && { working: true }),
    ...(glint && { glint }),
    ...(unseen && { unseen: unseen.by }),
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

/** A Tile's kind and place, by its slot under its parent, as the tile widget reads a slot. */
function seated(slot: Slot, parent: string): Subject {
  const { kind, place } = seatOf(slot)
  return { kind, title: '', at: place, parent }
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
  const parentTitle = (tile: string) => {
    const held = tile === system.root.id ? system.root : system.tiles[tile]
    return titleOf((held?._tag === 'Tile' ? held.title : proposed?.ghosts.get(tile)?.title) ?? '')
  }
  const described = (preview: string) => (preview === '' ? {} : { description: preview })
  if (id === system.root.id) {
    const { title, preview } = system.root
    const kind = title === '' ? 'untitled' : 'root'
    return { place: placeOf({ kind, title, at: 'center' }), ...described(preview) }
  }
  const tile = system.tiles[id]
  if (tile?._tag === 'Tile') {
    return {
      place: placeOf(seated(tile.slot, parentTitle(tile.parent))),
      ...described(tile.preview),
    }
  }
  const ghost = proposed?.ghosts.get(id)
  if (ghost === undefined) return undefined
  return {
    place: placeOf(seated(ghost.slot, parentTitle(ghost.parent))),
    ...described(ghost.preview),
  }
}
