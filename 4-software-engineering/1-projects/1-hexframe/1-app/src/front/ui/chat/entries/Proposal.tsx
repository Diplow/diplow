// What the agent proposes in ask, on the widget's frame (`Widget`), in the agent's voice: its hex, a
// kicker saying who proposes, the title, then each change on a line, and the actions: Accept, its ⌘↵
// shown, Discard at the far end, asked first (`Dialog`). Once decided the widget gives its surface back
// and leaves its receipt, its changes folded under it, with the Undo while one is possible. Decided
// from the widget, the focus moves to the receipt, so the keyboard never falls back to the top of the
// page; decided elsewhere, in another tab or by a poll, the focus stays where the user is and a status
// says it.
import { ListChecks } from 'lucide-react'
import { type FocusEvent, useState } from 'react'

import { m } from '#/paraglide/messages'

import { Dialog } from '../../layouts/Dialog'
import { Widget } from '../layouts/Widget'
import { useHandOffState } from '../state/useHandOffState'
import { type Change, Changes, Receipt } from './Receipt'

/** How a Proposal stands: waiting for the user, accepted, or discarded. */
export type Fate = 'open' | 'accepted' | 'discarded'

export interface ProposalProps {
  /** What it does, in a few words. */
  title: string
  /** One line under the title, quieter. */
  summary?: string | undefined
  changes: readonly Change[]
  fate: Fate
  at: Date
  /** What was accepted has been put back since. */
  undone?: boolean
  onAccept: () => void
  onDiscard: () => void
  /** Puts back what was accepted; none where it cannot be undone. */
  onUndo?: (() => void) | undefined
  /** A decision on its way: the actions wait. */
  pending?: boolean
}

export function Proposal(props: ProposalProps) {
  const { title, changes, fate, at, undone = false, onUndo, pending = false } = props
  const decided =
    fate === 'accepted' ? m.chat_proposal_accepted({ title }) : m.chat_proposal_discarded({ title })
  const { handOff, status, onFocus, onBlur } = useHandOffState(
    fate === 'open' ? 'open' : 'decided',
    decided,
  )
  return (
    <>
      {fate === 'open' ? (
        <Open {...props} onFocus={onFocus} onBlur={onBlur} />
      ) : (
        <Receipt
          takesFocus={handOff}
          words={[decided]}
          at={at}
          changes={changes}
          tone={fate === 'accepted' ? 'agent' : 'quiet'}
          onUndo={fate === 'accepted' ? onUndo : undefined}
          pending={pending}
          undone={undone}
        />
      )}
      {/* Here from the start, so a screen reader hears what it comes to say. */}
      <p role="status" className="sr-only">
        {status}
      </p>
    </>
  )
}

interface OpenProps extends ProposalProps {
  onFocus: () => void
  onBlur: (event: FocusEvent<HTMLElement>) => void
}

function Open(props: OpenProps) {
  const { title, summary, changes, onAccept, onDiscard, pending = false, onFocus, onBlur } = props
  const [asking, setAsking] = useState(false)
  return (
    // The focus is the widget's, or the dialog's it opened, whose events reach here through React's tree.
    <div onFocus={onFocus} onBlur={onBlur}>
      <Widget
        voice="agent"
        icon={<ListChecks />}
        kicker={m.chat_proposal_kicker()}
        title={title}
        {...(summary === undefined ? {} : { subtitle: summary })}
        actions={
          // A decision on its way: nothing more to decide until it lands.
          pending
            ? []
            : [
                {
                  label: m.chat_proposal_accept(),
                  shortcut: { key: 'Enter', mod: true },
                  onSelect: onAccept,
                },
                {
                  label: m.chat_proposal_discard(),
                  apart: true,
                  onSelect: () => {
                    setAsking(true)
                  },
                },
              ]
        }
      >
        {changes.length === 0 ? (
          <p className="text-[0.84375rem] font-light text-muted-foreground">
            {m.chat_proposal_empty()}
          </p>
        ) : (
          <Changes changes={changes} className="text-[0.84375rem]" />
        )}
      </Widget>
      <Dialog
        open={asking}
        onOpenChange={setAsking}
        kicker={m.chat_proposal_discard_kicker()}
        title={m.chat_proposal_discard_title()}
        confirmLabel={m.chat_proposal_discard()}
        onConfirm={onDiscard}
      >
        {m.chat_proposal_discard_description()}
      </Dialog>
    </div>
  )
}
