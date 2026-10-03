// One entry of the timeline: a Message, or what the user did on the canvas, a navigation or an
// operation. Times are the reader's, in the page's language.
import { cn } from 'cn'
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  Layers,
  Move,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'

import type { Entry, Navigation, Operation } from './timeline'
import { TileCard } from './TileCard'

export function ConversationEntry({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case 'message':
      return <Message entry={entry} />
    case 'navigation': {
      const { icon, text } = navigations[entry.navigation]
      return <Action icon={icon} text={text(entry.tile.title)} at={entry.at} />
    }
    case 'operation': {
      const { icon, text } = operations[entry.operation]
      return (
        <div className="grid gap-1.5">
          <Action icon={icon} text={text()} at={entry.at} />
          <TileCard tile={entry.tile} deleted={entry.operation === 'deleted'} />
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
          'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
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
      <span className="min-w-0 flex-1">{text}</span>
      <Time at={at} />
    </p>
  )
}

function Time({ at }: { at: Date }) {
  const time = new Intl.DateTimeFormat(getLocale(), { timeStyle: 'short' }).format(at)
  return <time dateTime={at.toISOString()}>{time}</time>
}

const navigations: Record<Navigation, { icon: LucideIcon; text: (title: string) => string }> = {
  centered: { icon: Crosshair, text: (title) => m.conversation_centered({ title }) },
  expanded: { icon: ChevronsUpDown, text: (title) => m.conversation_expanded({ title }) },
  collapsed: { icon: ChevronsDownUp, text: (title) => m.conversation_collapsed({ title }) },
  'context-shown': { icon: Layers, text: (title) => m.conversation_context_shown({ title }) },
  'context-hidden': { icon: Layers, text: (title) => m.conversation_context_hidden({ title }) },
}

const operations: Record<Operation, { icon: LucideIcon; text: () => string }> = {
  created: { icon: Plus, text: m.conversation_created },
  edited: { icon: Pencil, text: m.conversation_edited },
  moved: { icon: Move, text: m.conversation_moved },
  deleted: { icon: Trash2, text: m.conversation_deleted },
}
