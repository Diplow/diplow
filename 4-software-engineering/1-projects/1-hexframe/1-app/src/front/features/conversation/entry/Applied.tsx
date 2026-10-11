// What a Turn in apply wrote, told once it ended: how many changes the assistant applied, each told
// above in an Entry of its own, and, until the user undid them, the Undo that puts the System back as
// it stood before them, all of them or none; once undone, it says so.
import { CheckCheck } from 'lucide-react'

import type { Entry } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'

import { type Deciding, Time, UndoButton } from './parts'

interface AppliedProps {
  entry: Extract<Entry, { _tag: 'TurnApplied' }>
  /** None where nobody undoes it: it then only says what was applied. */
  decide?: Deciding | undefined
}

export function AppliedEntry({ entry, decide }: AppliedProps) {
  const { turn, changes, undone } = entry
  const title =
    changes === 1
      ? m.conversation_applied_title_one()
      : m.conversation_applied_title({ count: changes })
  return (
    <section
      aria-label={m.conversation_applied_label()}
      className="grid gap-2 rounded-lg border bg-muted/40 p-3"
    >
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCheck aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 font-medium text-foreground">{title}</span>
        {undone && <span>{m.conversation_applied_undone()}</span>}
        {undone && <span aria-hidden>·</span>}
        <Time at={entry.at} />
      </p>
      {!undone && decide !== undefined && <UndoButton batch={turn} decide={decide} />}
    </section>
  )
}
