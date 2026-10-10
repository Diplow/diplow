// One Entry of the timeline: a Message, its links to Tiles shown as their Titles, a click centering
// the canvas on one, or a line saying what happened, a change to the System, an import or where the
// user went, with who did it, or how a Turn ended when not by its answer. Titles are those the Entry
// carries, a navigation's and a link's those the System holds now; times are the reader's, in the
// page's language.
import { cn } from 'cn'
import {
  ArrowLeftRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  Hexagon,
  Import,
  Layers,
  Leaf,
  Link,
  Move,
  Navigation as NavigationIcon,
  Pencil,
  Plus,
  Square,
  Trash2,
  Unlink,
  type LucideIcon,
} from 'lucide-react'
import { Schema } from 'effect'

import {
  type Actor,
  type BadEnd,
  type Entry,
  type MessagePart,
  partsOf,
} from '#/domains/assistant/entities'
import type { OperationEvent } from '#/domains/mapping/operations'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { Gesture } from '#/front/ui/hex/view/view'

import type { Titles } from '../timeline/timeline'
import { Shortened } from './Shortened'

interface EntryProps {
  entry: Entry
  titles: Titles
  /** Centers the canvas on a Tile a Message links; none where there is no canvas to center. */
  onCenter?: ((tile: string) => void) | undefined
}

export function ConversationEntry({ entry, titles, onCenter }: EntryProps) {
  switch (entry._tag) {
    case 'Message':
      return <Message entry={entry} titles={titles} onCenter={onCenter} />
    case 'Navigation':
      return <NavigationLine entry={entry} titles={titles} />
    case 'Change': {
      const { icon, text } = isVerb(entry.verb) ? changes[entry.verb] : changed
      const names = { title: named(entry.tile.title), other: named(entry.other?.title ?? '') }
      return <Action icon={icon} text={text(actorOf(entry.actor), names)} at={entry.at} />
    }
    case 'Import':
      return <Action icon={Import} text={importText(entry)} at={entry.at} />
    case 'TurnEnded':
      return <Action icon={Square} text={turnEnds[entry.how]()} at={entry.at} />
  }
}

/** How a Turn ended, when not by its answer, as the timeline says it. */
const turnEnds: Record<BadEnd, () => string> = {
  stopped: m.conversation_turn_stopped,
  ceiling: m.conversation_turn_ceiling,
  allowance: m.conversation_turn_allowance,
  time: m.conversation_turn_time,
  sandbox: m.conversation_turn_sandbox,
}

function Message({
  entry,
  titles,
  onCenter,
}: {
  entry: Extract<Entry, { _tag: 'Message' }>
  titles: Titles
  onCenter: EntryProps['onCenter']
}) {
  const mine = entry.author === 'user'
  const shown = (tile: string) => linkText(titles, tile)
  return (
    <div className={cn('grid max-w-[85%] gap-1', mine ? 'ml-auto justify-items-end' : 'mr-auto')}>
      <p className="text-xs text-muted-foreground">
        {mine ? m.conversation_you() : m.conversation_assistant()} · <Time at={entry.at} />
      </p>
      <div
        className={cn(
          'grid justify-items-start rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap wrap-anywhere',
          mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted',
        )}
      >
        <Shortened parts={partsOf(entry.text)} shown={shown}>
          {(parts) =>
            parts.map((part, index) => (
              // The pieces of one text, never reordered: their place is their key.
              <Piece key={index} part={part} titles={titles} onCenter={onCenter} />
            ))
          }
        </Shortened>
      </div>
    </div>
  )
}

/** What a link shows: `@` and its Tile's Title now, "Untitled" for an untitled one; once deleted, so. */
const linkText = (titles: Titles, tile: string) => {
  const title = titles[tile]
  return title === undefined ? m.conversation_link_broken() : `@${named(title)}`
}

/** One piece of a Message: its words, or a link to a Tile, a button centering it, or broken. */
function Piece({
  part,
  titles,
  onCenter,
}: {
  part: MessagePart
  titles: Titles
  onCenter: EntryProps['onCenter']
}) {
  if (part._tag === 'Text') return part.text
  const { tile } = part
  const text = linkText(titles, tile)
  const chip = 'inline-flex items-center gap-0.5 rounded-sm px-0.5 align-baseline font-medium'
  const title = titles[tile]
  if (title === undefined) {
    return (
      <span className={cn(chip, 'line-through opacity-70')}>
        <Unlink aria-hidden className="size-3 shrink-0 self-center" />
        {text}
      </span>
    )
  }
  if (onCenter === undefined) return <span className={chip}>{text}</span>
  return (
    <button
      type="button"
      aria-label={m.hex_tile_center({ title: named(title) })}
      className={cn(
        chip,
        'underline decoration-1 underline-offset-2 outline-none hover:decoration-2 focus-visible:ring-[3px] focus-visible:ring-ring/50',
      )}
      onClick={() => {
        onCenter(tile)
      }}
    >
      {text}
    </button>
  )
}

/** Where the user went: the last gesture they made, on its Tile, and how many came before it. */
function NavigationLine({
  entry,
  titles,
}: {
  entry: Extract<Entry, { _tag: 'Navigation' }>
  titles: Titles
}) {
  const last = entry.steps.at(-1)
  const told = last !== undefined && isGesture(last.gesture) ? navigations[last.gesture] : undefined
  const title = last === undefined ? '' : (titles[last.tile] ?? m.conversation_tile_gone())
  const text = told === undefined ? m.conversation_navigated() : told.text(named(title))
  return (
    <Action
      icon={told?.icon ?? NavigationIcon}
      text={text}
      detail={entry.gestures > 1 ? m.conversation_gestures({ count: entry.gestures }) : undefined}
      at={entry.at}
    />
  )
}

interface ActionProps {
  icon: LucideIcon
  text: string
  /** What follows the line, quieter: how many gestures a navigation merged. */
  detail?: string | undefined
  at: Date
}

/** A line saying what happened, with its icon and its time. */
function Action({ icon: Icon, text, detail, at }: ActionProps) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 wrap-anywhere">
        {text}
        {detail !== undefined && <span className="opacity-70"> · {detail}</span>}
      </span>
      <Time at={at} />
    </p>
  )
}

function Time({ at }: { at: Date }) {
  const time = new Intl.DateTimeFormat(getLocale(), { timeStyle: 'short' }).format(at)
  return <time dateTime={at.toISOString()}>{time}</time>
}

/** A Title as the timeline says it: an untitled Tile, the Root before its name, as "Untitled". */
const named = (title: string) => (title === '' ? m.system_untitled() : title)

/** Who did it, as a sentence starts: none for the user, who reads "You" in each message. */
function actorOf(actor: Actor): string | undefined {
  if (actor._tag === 'You') return undefined
  if (actor._tag === 'Assistant') return m.conversation_assistant()
  return actor.name === undefined
    ? m.conversation_revoked_key()
    : m.conversation_key({ name: actor.name })
}

/** A message said by the user, or by someone else, who starts the sentence. */
function by<P extends object>(
  mine: (inputs: P) => string,
  theirs: (inputs: P & { actor: string }) => string,
) {
  return (actor: string | undefined, inputs: P) =>
    actor === undefined ? mine(inputs) : theirs({ ...inputs, actor })
}

/** The Titles a change's sentence names: the Tile it is about, and the other one, if any. */
type Names = { title: string; other: string }

interface Told {
  icon: LucideIcon
  text: (actor: string | undefined, names: Names) => string
}

/** What each of Mapping's changes says once it happened, in the past tense, by whom. */
const changes: Record<OperationEvent['_tag'], Told> = {
  TileCreated: { icon: Plus, text: by(m.conversation_created, m.conversation_created_by) },
  TileEdited: { icon: Pencil, text: by(m.conversation_edited, m.conversation_edited_by) },
  TileMoved: { icon: Move, text: by(m.conversation_moved, m.conversation_moved_by) },
  TilesSwapped: {
    icon: ArrowLeftRight,
    text: by(m.conversation_swapped, m.conversation_swapped_by),
  },
  TileDeleted: { icon: Trash2, text: by(m.conversation_deleted, m.conversation_deleted_by) },
  ReferenceCreated: {
    icon: Link,
    text: by(m.conversation_referenced, m.conversation_referenced_by),
  },
  ReferenceDeleted: {
    icon: Unlink,
    text: by(m.conversation_unreferenced, m.conversation_unreferenced_by),
  },
}

/** A change whose verb this page does not know yet, which Mapping may have learned since. */
const changed: Told = { icon: Pencil, text: by(m.conversation_changed, m.conversation_changed_by) }

const isVerb = (verb: string): verb is OperationEvent['_tag'] => Object.hasOwn(changes, verb)

const isGesture = Schema.is(Gesture)

/** What an import says: the Tile it landed as, and how many came with it below it. */
function importText({ tile, count, actor }: Extract<Entry, { _tag: 'Import' }>) {
  const who = actorOf(actor)
  const title = named(tile.title)
  if (count === 0) return by(m.conversation_imported, m.conversation_imported_by)(who, { title })
  if (count === 1) {
    return by(m.conversation_imported_one, m.conversation_imported_one_by)(who, { title })
  }
  return by(m.conversation_imported_many, m.conversation_imported_many_by)(who, { title, count })
}

/** What each of the canvas's gestures says once the user made it, in the past tense. */
const navigations: Record<Gesture, { icon: LucideIcon; text: (title: string) => string }> = {
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
