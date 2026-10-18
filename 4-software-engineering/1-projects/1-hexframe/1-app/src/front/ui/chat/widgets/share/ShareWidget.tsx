// Who may see a tile, in the conversation: the app's own widget, so it carries no voice. Every one
// who reaches the tile, each with what they may do there and where that comes from, set on this
// tile or on one above it; Everyone first, whose value its owner sets here, read, none, or inherit,
// which leaves it to the tile above; then each person it is shared with, named by their star, whose
// value the owner sets to none, to read and to any of read's companions, write and @, or back to
// inherit; each row running on to the curve at its height; then the link the tile is visited by.
// Someone is added, and the link copied, from the widget's actions. Controlled: the rows are worded
// by the caller, who says what each choice does, as Mapping decides it, and who finds someone.
import { cn } from 'cn'
import { Link, Share2, UserPlus } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { runsToCurve, toCurve } from '../../../layouts/screen/state/useAlongCurve'
import { Widget } from '../../layouts/Widget'
import type { Rights } from './rights'

/**
 * What the owner sets on the tile for someone: a value, none to read, write and @, or what the tile
 * above has. Everyone is offered read, none or inherit alone: it never writes.
 */
export type ShareChoice = Rights | 'inherit'

/** Someone who reaches the tile, as its row shows them, every word already its caller's. */
export interface ReachRow {
  readonly key: string
  /** Who: Everyone, someone by their star's title, a group. */
  readonly who: string
  /** What they may do there: read, none, read and write. */
  readonly value: string
  /** Where that comes from: set here, from your star, from the tile above that sets it. */
  readonly from: string
}

/** A row whose value the owner sets here: what they set for it on this tile. */
export interface Chosen {
  readonly choice: ShareChoice
}

interface ShareWidgetProps {
  /** The tile shared, by its title. */
  title: string
  /** Everyone's row, and what its owner set for it on this tile. */
  everyone: ReachRow & Chosen
  /** Everyone else who reaches it: someone, with what its owner set, or a group, which they don't. */
  others: readonly (ReachRow & Partial<Chosen>)[]
  /** A choice on its way: the choices wait. */
  sending?: boolean
  /** A choice made, on the row of this key, Everyone's included. */
  onChoose: (key: string, choice: ShareChoice) => void
  /** Opens what finds someone to share the tile with. */
  onAdd: () => void
  /** The link the tile is visited by, which leads whoever may read it there. */
  link: string
  onCopyLink: () => void
  onDone: () => void
}

/** The share widget: who reaches the tile, Everyone's choice, and its link. */
export function ShareWidget({
  title,
  everyone,
  others,
  sending = false,
  onChoose,
  onAdd,
  link,
  onCopyLink,
  onDone,
}: ShareWidgetProps) {
  return (
    <Widget
      voice="app"
      icon={<Share2 />}
      kicker={m.widget_share_kicker()}
      title={title}
      subtitle={m.widget_share_what()}
      actions={[
        { label: m.widget_share_add(), icon: <UserPlus />, onSelect: onAdd },
        // The action keeps its word, and its focus: the toast says it is copied.
        { label: m.widget_share_copy_link(), icon: <Link />, onSelect: onCopyLink },
        { label: m.widget_share_done(), onSelect: onDone },
      ]}
      onDismiss={onDone}
    >
      <ul className="grid">
        <Row row={everyone} hint={m.widget_share_everyone_hint()}>
          <Choices
            offered={everyoneChoices}
            legend={m.widget_share_choose()}
            chosen={everyone.choice}
            sending={sending}
            onChoose={(choice) => {
              onChoose(everyone.key, choice)
            }}
          />
        </Row>
        {others.map((row) => (
          <Row key={row.key} row={row}>
            {row.choice !== undefined && (
              <Choices
                offered={someoneChoices}
                legend={m.widget_share_choose_for({ who: row.who })}
                chosen={row.choice}
                sending={sending}
                onChoose={(choice) => {
                  onChoose(row.key, choice)
                }}
              />
            )}
          </Row>
        ))}
      </ul>
      <p
        ref={toCurve}
        className={cn(
          runsToCurve,
          'mt-3 font-mono text-[0.6875rem] leading-normal break-all text-muted-foreground',
        )}
      >
        {link}
      </p>
    </Widget>
  )
}

/** Someone who reaches the tile: who, then what they may do there and where it comes from. */
function Row({ row, hint, children }: { row: ReachRow; hint?: string; children?: ReactNode }) {
  return (
    <li
      ref={toCurve}
      className={cn(runsToCurve, 'grid gap-1.5 border-t border-border py-2.5 last:border-b')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm text-foreground">{row.who}</p>
        <p className="font-mono text-[0.6875rem] leading-normal text-muted-foreground">
          <em className="text-foreground not-italic">{row.value}</em>
          {m.widget_share_from_joiner()}
          {row.from}
        </p>
      </div>
      {hint !== undefined && (
        <p className="text-[0.71875rem] leading-snug text-muted-foreground">{hint}</p>
      )}
      {children}
    </li>
  )
}

/** Each choice, as its button says it. */
const labels: Record<ShareChoice, () => string> = {
  none: m.widget_share_choice_none,
  read: m.widget_share_choice_read,
  'read+write': m.widget_share_choice_read_write,
  'read+@': m.widget_share_choice_read_agent,
  'read+write+@': m.widget_share_choice_read_write_agent,
  inherit: m.widget_share_choice_inherit,
}

/** What Everyone is offered: read, none, or inherit, never write nor @. */
const everyoneChoices: readonly ShareChoice[] = ['read', 'none', 'inherit']

/** What someone is offered: every value, then inherit. */
const someoneChoices: readonly ShareChoice[] = [
  'none',
  'read',
  'read+write',
  'read+@',
  'read+write+@',
  'inherit',
]

/** A row's value on the tile, one of those offered, as a radio group the arrows go round. */
function Choices({
  offered,
  legend,
  chosen,
  sending,
  onChoose,
}: {
  offered: readonly ShareChoice[]
  legend: string
  chosen: ShareChoice
  sending: boolean
  onChoose: (choice: ShareChoice) => void
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-wrap gap-1.5" aria-busy={sending}>
      <legend className="sr-only">{legend}</legend>
      {offered.map((choice) => (
        <label
          key={choice}
          className={cn(
            'cursor-pointer border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground has-focus-visible:outline-1 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--voice) pointer-coarse:py-2.5',
            chosen === choice && 'border-(--voice) bg-foreground/7 text-foreground',
          )}
        >
          <input
            type="radio"
            name={name}
            value={choice}
            checked={chosen === choice}
            onChange={() => {
              // On its way, a second choice waits for the first.
              if (!sending) onChoose(choice)
            }}
            className="sr-only"
          />
          {labels[choice]()}
        </label>
      ))}
    </fieldset>
  )
}
