// The Conversation beside the canvas: its timeline a day at a time, newest at the bottom beside the
// input, a button above the oldest day shown reading the day before, a Message's link centering the
// canvas on its Tile, a Proposal accepted or discarded where it stands, and the input the user writes
// to the agent in, `@`ing their Tiles, beside the Mode and its switch, which says so when the Account
// may not use the Assistant. While a Turn runs, the input waits, and above it the agent's step shows
// live beside a Stop.
import { cn } from 'cn'
import { Loader2, MessagesSquare, Square } from 'lucide-react'

import type { TurnStep } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { EmptyState } from '#/front/ui/layouts/states'
import { Button } from '#/front/ui/atoms/controls/button'

import { Composer } from './composer/Composer'
import type { Mentionable } from './composer/mention'
import type { ModeChoice } from './composer/ModeSwitch'
import type { Day } from './timeline/timeline'
import { ConversationEntry } from './entry/Entry'
import type { Deciding } from './entry/parts'

/** A Turn running, as the timeline shows it. */
interface Running {
  /** What its agent is doing now; none while it thinks. */
  step?: TurnStep | undefined
  /** Stops it. */
  stop: () => void
  /** The Stop is on its way. */
  stopping: boolean
}

/** The day before the oldest one shown, which the reader may ask for. */
interface Earlier {
  /** Reads the latest earlier day holding an Entry. */
  show: () => void
  /** The day is on its way. */
  pending: boolean
}

interface ConversationProps {
  /** The days shown, oldest first, each with its Entries oldest first. */
  days: readonly Day[]
  /** A Message the user sent, trimmed and never empty, each Tile it `@`s linked by its id. */
  onSend: (text: string) => void
  /** The Tiles the user may `@`. */
  tiles: ReadonlyArray<Mentionable>
  /** Centers the canvas on a Tile a Message links; none where there is no canvas. */
  onCenter?: ((tile: string) => void) | undefined
  /** The Account may not use the Assistant: its Messages are kept, and no agent answers them. */
  unavailable?: boolean
  /** The Turn running, its agent's step now if any, and how to stop it: the input waits meanwhile. */
  running?: Running | undefined
  /** Nothing can be sent yet, the page still reading what a Message is sent from. */
  waiting?: boolean
  /** An earlier day holding an Entry, when there is one. */
  earlier?: Earlier | undefined
  /** The Conversation's Mode and its switch; none before it is read. */
  mode?: ModeChoice | undefined
  /**
   * Accepts or discards the open Proposal, or undoes what an accepted one or a Turn applied; none
   * where nobody decides.
   */
  decide?: Deciding | undefined
  className?: string
}

export function Conversation({
  days,
  onSend,
  tiles,
  onCenter,
  unavailable = false,
  running,
  waiting = false,
  earlier,
  mode,
  decide,
  className,
}: ConversationProps) {
  const now = new Date()
  const shown = days.filter((day) => day.entries.length > 0)
  return (
    <section
      aria-label={m.conversation_label()}
      className={cn(
        'flex min-h-0 flex-col rounded-xl border bg-card text-card-foreground',
        className,
      )}
    >
      {/* Laid out in reverse, so the timeline opens scrolled to its newest entry. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
        <div className="grid gap-6 p-4">
          {earlier !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-center"
              disabled={earlier.pending}
              onClick={earlier.show}
            >
              {m.conversation_earlier()}
            </Button>
          )}
          {shown.length === 0 && earlier === undefined ? (
            <EmptyState
              icon={<MessagesSquare />}
              title={m.conversation_empty_title()}
              description={m.conversation_empty_description()}
            />
          ) : (
            shown.map((day) => (
              <DayOfEntries key={day.key} day={day} now={now} onCenter={onCenter} decide={decide} />
            ))
          )}
        </div>
      </div>
      {running !== undefined && <Working running={running} />}
      <Composer
        onSend={onSend}
        tiles={tiles}
        unavailable={unavailable}
        busy={running !== undefined || waiting}
        mode={mode}
      />
    </section>
  )
}

function DayOfEntries({
  day,
  now,
  onCenter,
  decide,
}: {
  day: Day
  now: Date
  onCenter: ConversationProps['onCenter']
  decide: ConversationProps['decide']
}) {
  return (
    <section className="grid gap-3">
      <h2 className="sticky top-0 z-10 -mx-4 flex justify-center bg-card py-2">
        <span className="rounded-full border bg-card px-3 py-0.5 text-xs font-medium text-muted-foreground">
          {dayLabel(day, now)}
        </span>
      </h2>
      <ol className="grid gap-3">
        {day.entries.map((entry) => (
          <li key={entry.id}>
            <ConversationEntry
              entry={entry}
              titles={day.titles}
              onCenter={onCenter}
              decide={decide}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

function dayLabel(day: Day, now: Date): string {
  if (day.relative === 'today') return m.conversation_today()
  if (day.relative === 'yesterday') return m.conversation_yesterday()
  const year = day.date.getFullYear() === now.getFullYear() ? undefined : 'numeric'
  return new Intl.DateTimeFormat(getLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year,
  }).format(day.date)
}

/** The Turn running: the agent's step now, live, and the Stop. */
function Working({ running }: { running: Running }) {
  const { step } = running
  return (
    <div className="flex items-center gap-3 border-t px-4 py-2" role="status">
      <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
      <p className="grid min-w-0 flex-1 text-xs">
        <span className="font-medium">{m.conversation_working()}</span>
        <span className="truncate font-mono text-muted-foreground">
          {step === undefined
            ? m.conversation_thinking()
            : [step.tool, step.detail].filter((part) => part !== undefined).join(' · ')}
        </span>
      </p>
      <Button variant="outline" size="sm" disabled={running.stopping} onClick={running.stop}>
        <Square aria-hidden />
        {m.conversation_stop()}
      </Button>
    </div>
  )
}
