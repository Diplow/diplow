// The Conversation beside the canvas: its timeline split by day, newest at the bottom beside the
// input, and the input the user writes to the agent in.
import { cn } from 'cn'
import { MessagesSquare } from 'lucide-react'

import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { EmptyState } from '#/front/ui/feedback/states'
import { useAppForm } from '#/front/ui/inputs/forms/form'

import { splitByDay, type Day, type Entry } from './timeline/timeline'
import { ConversationEntry } from './entry/Entry'

interface ConversationProps {
  entries: readonly Entry[]
  /** A Message the user sent, trimmed and never empty. */
  onSend: (text: string) => void
  className?: string
}

export function Conversation({ entries, onSend, className }: ConversationProps) {
  const now = new Date()
  const days = splitByDay(entries, now)
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
          {days.length === 0 ? (
            <EmptyState
              icon={<MessagesSquare />}
              title={m.conversation_empty_title()}
              description={m.conversation_empty_description()}
            />
          ) : (
            days.map((day) => <DayOfEntries key={day.key} day={day} now={now} />)
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
            <ConversationEntry entry={entry} />
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
