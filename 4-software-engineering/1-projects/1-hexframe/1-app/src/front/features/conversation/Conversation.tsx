// The Conversation beside the canvas: its timeline a day at a time, newest at the bottom beside the
// input, a button above the oldest day shown reading the day before, and the input the user writes to
// the agent in.
import { cn } from 'cn'
import { MessagesSquare } from 'lucide-react'

import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { EmptyState } from '#/front/ui/feedback/states'
import { Button } from '#/front/ui/inputs/controls/button'
import { useAppForm } from '#/front/ui/inputs/forms/form'

import type { Day } from './timeline/timeline'
import { ConversationEntry } from './entry/Entry'

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
  /** An earlier day holding an Entry, when there is one. */
  earlier?: Earlier | undefined
  className?: string
}

export function Conversation({ days, onSend, earlier, className }: ConversationProps) {
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
      <MessageInput onSend={onSend} />
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

function MessageInput({ onSend }: { onSend: (text: string) => void }) {
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
        void form.handleSubmit()
      }}
    >
      <form.AppField name="message" validators={{ onSubmit: written }}>
        {(field) => (
          <field.TextareaField
            label={m.conversation_message_label()}
            placeholder={m.conversation_message_placeholder()}
          />
        )}
      </form.AppField>
      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton>{m.conversation_send()}</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  )
}
