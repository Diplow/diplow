// One entry of the timeline: a Message, or what the user did on the canvas, a navigation or an
// operation. Times are the reader's, in the page's language.
import { cn } from 'cn'
import {
  ArrowLeftRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  Hexagon,
  Layers,
  Leaf,
  Link,
  Move,
  Pencil,
  Plus,
  Trash2,
  Unlink,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import type { Operation } from '#/domains/mapping/operations'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'

import type { Navigated } from '#/front/features/facts'

import type { Entry } from '../timeline/timeline'
import { TileCard } from './TileCard'

export function ConversationEntry({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case 'message':
      return <Message entry={entry} />
    case 'navigation': {
      const { icon, text } = navigations[entry.gesture]
      return <Action icon={icon} text={text(entry.tile.title)} at={entry.at} />
    }
    case 'operation': {
      const { icon, text } = operations[entry.operation]
      return (
        <div className="grid gap-1.5">
          <Action icon={icon} text={text()} at={entry.at} />
          <TileCard tile={entry.tile} deleted={entry.operation === 'DeleteTile'} />
        </div>
      )
    }
  }
}

function Message({ entry }: { entry: Extract<Entry, { kind: 'message' }> }) {
  const mine = entry.author === 'user'
  return (
    <div className={cn('grid max-w-[85%] gap-1', mine ? 'ml-auto justify-items-end' : 'mr-auto')}>
      <p className="text-xs text-muted-foreground">
        {mine ? m.conversation_you() : m.conversation_assistant()} · <Time at={entry.at} />
      </p>
      <p
        className={cn(
          'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap wrap-anywhere',
          mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted',
        )}
      >
        {entry.text}
      </p>
    </div>
  )
}

/** A line saying what the user did, with its icon and its time. */
function Action({ icon: Icon, text, at }: { icon: LucideIcon; text: ReactNode; at: Date }) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 wrap-anywhere">{text}</span>
      <Time at={at} />
    </p>
  )
}

function Time({ at }: { at: Date }) {
  const time = new Intl.DateTimeFormat(getLocale(), { timeStyle: 'short' }).format(at)
  return <time dateTime={at.toISOString()}>{time}</time>
}

/** What each of the canvas's gestures says once the user made it, in the past tense. */
const navigations: Record<
  Navigated['gesture'],
  { icon: LucideIcon; text: (title: string) => string }
> = {
  center: { icon: Crosshair, text: (title) => m.conversation_centered({ title }) },
  expand: { icon: ChevronsUpDown, text: (title) => m.conversation_expanded({ title }) },
  collapse: { icon: ChevronsDownUp, text: (title) => m.conversation_collapsed({ title }) },
  'show-context': { icon: Layers, text: (title) => m.conversation_context_shown({ title }) },
  'hide-context': { icon: Layers, text: (title) => m.conversation_context_hidden({ title }) },
  'show-leaves': { icon: Leaf, text: (title) => m.conversation_leaves_shown({ title }) },
  'hide-leaves': { icon: Leaf, text: (title) => m.conversation_leaves_hidden({ title }) },
  'show-children-around': {
    icon: Hexagon,
    text: (title) => m.conversation_children_around({ title }),
  },
  'show-branches-around': {
    icon: Hexagon,
    text: (title) => m.conversation_branches_around({ title }),
  },
  'show-leaves-around': { icon: Hexagon, text: (title) => m.conversation_leaves_around({ title }) },
}

/** What each of Mapping's Operations says once the user did it, in the past tense. */
const operations: Record<Operation['_tag'], { icon: LucideIcon; text: () => string }> = {
  CreateTile: { icon: Plus, text: m.conversation_created },
  EditTile: { icon: Pencil, text: m.conversation_edited },
  MoveTile: { icon: Move, text: m.conversation_moved },
  SwapTiles: { icon: ArrowLeftRight, text: m.conversation_swapped },
  DeleteTile: { icon: Trash2, text: m.conversation_deleted },
  CreateReference: { icon: Link, text: m.conversation_referenced },
  DeleteReference: { icon: Unlink, text: m.conversation_unreferenced },
}
