// What the timeline's Entries share: a time in the reader's language, a Title as the timeline says
// it, and the icon of each of Mapping's changes, which a change and a Proposal draw alike.
import {
  ArrowLeftRight,
  Link,
  Move,
  Pencil,
  Plus,
  Trash2,
  Unlink,
  type LucideIcon,
} from 'lucide-react'

import type { OperationEvent } from '#/domains/mapping/operations'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'

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
