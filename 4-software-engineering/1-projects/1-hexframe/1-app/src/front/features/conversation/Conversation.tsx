// The Conversation beside the canvas: its timeline a day at a time, newest at the bottom beside the
// input, a button above the oldest day shown reading the day before, and the input the user writes to
// the agent in, which says so when the Account may not use the Assistant. While a Turn runs, the input
// waits, and above it the agent's step shows live beside a Stop.
import { cn } from 'cn'
import { Loader2, MessagesSquare, Square } from 'lucide-react'

import type { TurnStep } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { EmptyState } from '#/front/ui/feedback/states'
import { Button } from '#/front/ui/inputs/controls/button'
import { useAppForm } from '#/front/ui/inputs/forms/form'

import type { Day } from './timeline/timeline'
import { ConversationEntry } from './entry/Entry'

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
  /** A Message the user sent, trimmed and never empty. */
  onSend: (text: string) => void
  /** The Account may not use the Assistant: its Messages are kept, and no agent answers them. */
  unavailable?: boolean
  /** The Turn running, its agent's step now if any, and how to stop it: the input waits meanwhile. */
  running?: Running | undefined
  /** Nothing can be sent yet, the page still reading what a Message is sent from. */
  waiting?: boolean
  /** An earlier day holding an Entry, when there is one. */
  earlier?: Earlier | undefined
  className?: string
}

export function Conversation({
  days,
  onSend,
  unavailable = false,
  running,
  waiting = false,
  earlier,
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
            shown.map((day) => <DayOfEntries key={day.key} day={day} now={now} />)
          )}
        </div>
      </div>
      {running !== undefined && <Working running={running} />}
      <MessageInput
        onSend={onSend}
        unavailable={unavailable}
        busy={running !== undefined || waiting}
      />
    </section>
  )
}

function DayOfEntries({ day, now }: { day: Day; now: Date }) {
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
            <ConversationEntry entry={entry} titles={day.titles} />
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

function MessageInput({
  onSend,
  unavailable,
  busy,
}: {
  onSend: (text: string) => void
  unavailable: boolean
  busy: boolean
}) {
  const form = useAppForm({
    defaultValues: { message: '' },
    onSubmit: ({ value, formApi }) => {
      onSend(value.message.trim())
      formApi.reset()
    },
  })
  const written = ({ value }: { value: string }) =>
    value.trim() === '' ? m.conversation_message_required() : undefined
  return (
    <form
      noValidate
      className="grid gap-3 border-t p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy) void form.handleSubmit()
      }}
    >
      <fieldset disabled={busy} className="grid gap-3">
        <form.AppField name="message" validators={{ onSubmit: written }}>
          {(field) => (
            <field.TextareaField
              label={m.conversation_message_label()}
              placeholder={m.conversation_message_placeholder()}
            />
          )}
        </form.AppField>
        <div className="flex items-center justify-end gap-3">
          {unavailable && (
            <p className="mr-auto text-sm text-muted-foreground">
              {m.conversation_assistant_unavailable()}
            </p>
          )}
          <form.AppForm>
            <form.SubmitButton>{m.conversation_send()}</form.SubmitButton>
          </form.AppForm>
        </div>
      </fieldset>
    </form>
  )
}
