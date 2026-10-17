// Who may see a tile, in the conversation: the app's own widget, so it carries no voice. Every one
// who reaches the tile, each with what they may do there and where that comes from, set on this
// tile or on one above it; Everyone first, whose value its owner sets here, read, none, or inherit,
// which leaves it to the tile above, each row running on to the curve at its height; then the link
// the tile is visited by, copied from the widget's actions. Controlled: the rows are worded by the
// caller, who says what each choice does, as Mapping decides it.
import { cn } from 'cn'
import { Link, Share2 } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { runsToCurve, toCurve } from '../../../layouts/screen/state/useAlongCurve'
import { Widget } from '../../layouts/Widget'

/** What the owner sets on the tile for Everyone: read, none, or what the tile above has. */
export type ShareChoice = 'read' | 'none' | 'inherit'

/** Someone who reaches the tile, as its row shows them, every word already its caller's. */
export interface ReachRow {
  readonly key: string
  /** Who: Everyone, an account, a group. */
  readonly who: string
  /** What they may do there: read, none, read and write. */
  readonly value: string
  /** Where that comes from: set here, from your star, from the tile above that sets it. */
  readonly from: string
}

interface ShareWidgetProps {
  /** The tile shared, by its title. */
  title: string
  /** Everyone's row, and what its owner set for it on this tile. */
  everyone: ReachRow & { readonly choice: ShareChoice }
  /** Everyone else who reaches it. */
  others: readonly ReachRow[]
  /** Everyone's choice on its way: the choices wait. */
  sending?: boolean
  onChoose: (choice: ShareChoice) => void
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
        // The action keeps its word, and its focus: the toast says it is copied.
        { label: m.widget_share_copy_link(), icon: <Link />, onSelect: onCopyLink },
        { label: m.widget_share_done(), onSelect: onDone },
      ]}
      onDismiss={onDone}
    >
      <ul className="grid">
        <Row row={everyone} hint={m.widget_share_everyone_hint()}>
          <Choices chosen={everyone.choice} sending={sending} onChoose={onChoose} />
        </Row>
        {others.map((row) => (
          <Row key={row.key} row={row} />
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

const choices: readonly { readonly choice: ShareChoice; readonly label: () => string }[] = [
  { choice: 'read', label: m.widget_share_choice_read },
  { choice: 'none', label: m.widget_share_choice_none },
  { choice: 'inherit', label: m.widget_share_choice_inherit },
]

/** Everyone's value on the tile, one of three, as a radio group the arrows go round. */
function Choices({
  chosen,
  sending,
  onChoose,
}: {
  chosen: ShareChoice
  sending: boolean
  onChoose: (choice: ShareChoice) => void
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-wrap gap-1.5" aria-busy={sending}>
      <legend className="sr-only">{m.widget_share_choose()}</legend>
      {choices.map(({ choice, label }) => (
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
          {label()}
        </label>
      ))}
    </fieldset>
  )
}
