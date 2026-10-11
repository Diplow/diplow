// What the timeline's Entries share: a time in the reader's language, a Title as the timeline says
// it, the icon of each of Mapping's changes, which a change and a Proposal draw alike, how the user
// decides on what the assistant proposed or applied, and the Undo an accepted Proposal and an applied
// Turn offer alike.
import {
  ArrowLeftRight,
  Link,
  Move,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  Unlink,
  type LucideIcon,
} from 'lucide-react'

import type { OperationEvent } from '#/domains/mapping/operations'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { Button } from '#/front/ui/inputs/controls/button'

/**
 * How the user decides on what the assistant did: an open Proposal accepted or discarded, by its id,
 * and what an accepted Proposal or a Turn applied undone, by the Proposal's or the Turn's id; and
 * whether a decision is on its way.
 */
export interface Deciding {
  accept: (proposal: string) => void
  discard: (proposal: string) => void
  undo: (batch: string) => void
  pending: boolean
}

/** The Undo of what the assistant applied, by its id, waiting while a decision is on its way. */
export function UndoButton({ batch, decide }: { batch: string; decide: Deciding }) {
  return (
    <div className="flex justify-end">
      <Button
        variant="outline"
        size="sm"
        disabled={decide.pending}
        onClick={() => {
          decide.undo(batch)
        }}
      >
        <Undo2 aria-hidden />
        {m.conversation_undo()}
      </Button>
    </div>
  )
}

/** An Entry's time, in the reader's language. */
export function Time({ at }: { at: Date }) {
  const time = new Intl.DateTimeFormat(getLocale(), { timeStyle: 'short' }).format(at)
  return <time dateTime={at.toISOString()}>{time}</time>
}

/** A Title as the timeline says it: an untitled Tile, the Root before its name, as "Untitled". */
export const named = (title: string) => (title === '' ? m.system_untitled() : title)

/** The icon of each of Mapping's changes, as Mapping names its event. */
export const verbIcons: Record<OperationEvent['_tag'], LucideIcon> = {
  TileCreated: Plus,
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
