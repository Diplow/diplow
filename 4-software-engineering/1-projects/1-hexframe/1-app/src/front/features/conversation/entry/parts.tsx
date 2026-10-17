// What the timeline's Entries share: a Title as the timeline says it, the icon of each of Mapping's
// changes, which a change and a Proposal draw alike, and how the user decides on what the agent
// proposed or applied.
import {
  ArrowLeftRight,
  Link,
  Move,
  Pencil,
  SquarePlus,
  Trash2,
  Unlink,
  type LucideIcon,
} from 'lucide-react'

import type { OperationEvent } from '#/domains/mapping/operations'
import { m } from '#/paraglide/messages'

/**
 * How the user decides on what the agent did: an open Proposal accepted or discarded, by its id,
 * and what an accepted Proposal or a Turn applied undone, by the Proposal's or the Turn's id; and
 * whether a decision is on its way.
 */
export interface Deciding {
  accept: (proposal: string) => void
  discard: (proposal: string) => void
  undo: (applied: string) => void
  pending: boolean
}

/** A Title as the timeline says it: an untitled Tile, the Root before its name, as "Untitled". */
export const named = (title: string) => (title === '' ? m.system_untitled() : title)

/** The icon of each of Mapping's changes, as Mapping names its event. */
export const verbIcons: Record<OperationEvent['_tag'], LucideIcon> = {
  TileCreated: SquarePlus,
  TileEdited: Pencil,
  TileMoved: Move,
  TilesSwapped: ArrowLeftRight,
  TileDeleted: Trash2,
  ReferenceCreated: Link,
  ReferenceDeleted: Unlink,
}

/** Whether a verb is one of Mapping's changes this page knows. */
export const isVerb = (verb: string): verb is OperationEvent['_tag'] =>
  Object.hasOwn(verbIcons, verb)
