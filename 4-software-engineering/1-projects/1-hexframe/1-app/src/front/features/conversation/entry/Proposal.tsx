// A Proposal in the timeline: the changes the assistant drafted in ask, each a line naming its verb and
// its Tiles by the Titles Mapping gave them on the System the Proposal makes, as a change names them,
// then how it stands. While it is open, the user accepts it whole or discards it, a discard asked
// first; once decided, it says how, and once accepted it offers to undo it, until it is undone.
import { cn } from 'cn'
import { Check, ListChecks, Pencil, X } from 'lucide-react'

import type { Entry, Fate, ProposedChange } from '#/domains/assistant/entities'
import type { OperationEvent } from '#/domains/mapping/operations'
import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/inputs/controls/button'
import { ConfirmDialog } from '#/front/ui/overlays/ConfirmDialog'

import { type Deciding, isVerb, named, Time, UndoButton, verbIcons } from './parts'

interface ProposalProps {
  entry: Extract<Entry, { _tag: 'Proposal' }>
  /** None where nobody decides it, nor undoes it: it then only says how it stands. */
  decide?: Deciding | undefined
}

export function ProposalEntry({ entry, decide }: ProposalProps) {
  const { proposal, changes, fate } = entry
  return (
    <section
      aria-label={m.conversation_proposal_label()}
      className="grid gap-2 rounded-lg border bg-muted/40 p-3"
    >
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ListChecks aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 font-medium text-foreground">
          {m.conversation_proposal_title()}
        </span>
        <span className={fates[fate].className}>{fates[fate].label()}</span>
        <span aria-hidden>·</span>
        <Time at={entry.at} />
      </p>
      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{m.conversation_proposal_empty()}</p>
      ) : (
        <ul
          className={cn(
            'grid gap-1 text-sm',
            (fate === 'discarded' || fate === 'undone') && 'opacity-60',
          )}
        >
          {changes.map((change, index) => (
            // The changes of one Proposal, never reordered: their place is their key.
            <ProposedLine key={index} change={change} />
          ))}
        </ul>
      )}
      {fate === 'open' && decide !== undefined && (
        <div className="flex justify-end gap-2">
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" disabled={decide.pending}>
                <X aria-hidden />
                {m.conversation_proposal_discard()}
              </Button>
            }
            title={m.conversation_proposal_discard_title()}
            description={m.conversation_proposal_discard_description()}
            confirmLabel={m.conversation_proposal_discard()}
            destructive
            onConfirm={() => {
              decide.discard(proposal)
            }}
          />
          <Button
            size="sm"
            disabled={decide.pending}
            onClick={() => {
              decide.accept(proposal)
            }}
          >
            <Check aria-hidden />
            {m.conversation_proposal_accept()}
          </Button>
        </div>
      )}
      {fate === 'accepted' && decide !== undefined && (
        <UndoButton batch={proposal} decide={decide} />
      )}
    </section>
  )
}

/** How a Proposal stands, as its Entry says it. */
const fates: Record<Fate, { label: () => string; className: string }> = {
  open: { label: m.conversation_proposal_open, className: 'font-medium text-foreground' },
  accepted: { label: m.conversation_proposal_accepted, className: 'text-success' },
  discarded: { label: m.conversation_proposal_discarded, className: '' },
  undone: { label: m.conversation_proposal_undone, className: '' },
}

/** The Titles a drafted change names: the Tile it is about, and the other one, if any. */
type Names = { title: string; other: string }

/** What each of Mapping's changes would do, once accepted, as a Proposal says it. */
const proposed: Record<OperationEvent['_tag'], (names: Names) => string> = {
  TileCreated: m.conversation_proposal_create,
  TileEdited: m.conversation_proposal_edit,
  TileMoved: m.conversation_proposal_move,
  TilesSwapped: m.conversation_proposal_swap,
  TileDeleted: m.conversation_proposal_delete,
  ReferenceCreated: m.conversation_proposal_reference,
  ReferenceDeleted: m.conversation_proposal_unreference,
}

/** One drafted change: its icon and what it would do; a verb this page does not know said plainly. */
function ProposedLine({ change }: { change: ProposedChange }) {
  const names = { title: named(change.tile.title), other: named(change.other?.title ?? '') }
  const Icon = isVerb(change.verb) ? verbIcons[change.verb] : Pencil
  const text = isVerb(change.verb)
    ? proposed[change.verb](names)
    : m.conversation_proposal_change(names)
  return (
    <li className="flex items-center gap-2">
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 wrap-anywhere">{text}</span>
    </li>
  )
}
