// What the agent proposes in ask, on the widget's frame (`Widget`), in the agent's voice: its hex, a
// kicker saying who proposes, the title, then each change on a line, and the actions: Accept, its ⌘↵
// shown, Discard at the far end, asked first (`Dialog`). Once decided the widget gives its surface back
// and leaves its receipt, its changes folded under it, with the Undo while one is possible. Decided
// from the widget, the focus moves to the receipt, so the keyboard never falls back to the top of the
// page; decided elsewhere, in another tab or by a poll, the focus stays where the user is and a status
// says it (`UntilDecided`). A tile's draft or edit shows its words in full (`detail`), its place in the
// hex's (`mark`), and Edit it hands it to the user's own widget.
import { ListChecks } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { m } from '#/paraglide/messages'

import { Dialog } from '../../layouts/Dialog'
import { Widget } from '../layouts/Widget'
import { type Change, Changes, UntilDecided } from './Receipt'

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
  /** Who proposes, and where, in its kicker; the agent, by default. */
  kicker?: string
  /** Drawn in its hex's place: what it is about, in small, the frame a tile it drafts goes in. */
  mark?: ReactNode
  /**
   * What it changes, shown in full where a line each would say too little: a tile's words drafted, or
   * its edit where it falls. Its changes still fold under its receipt.
   */
  detail?: ReactNode
  /** Takes it to edit it: the user's own widget then holds the agent's words. */
  onEdit?: (() => void) | undefined
}

export function Proposal(props: ProposalProps) {
  const { title, changes, fate, at, undone = false, onUndo, pending = false } = props
  const decided =
    fate === 'accepted' ? m.chat_proposal_accepted({ title }) : m.chat_proposal_discarded({ title })
  return (
    <UntilDecided
      receipt={
        fate === 'open'
          ? undefined
          : {
              words: [decided],
              at,
              changes,
              tone: fate === 'accepted' ? 'agent' : 'quiet',
              onUndo: fate === 'accepted' ? onUndo : undefined,
              pending,
              undone,
            }
      }
    >
      <Open {...props} />
    </UntilDecided>
  )
}

function Open(props: ProposalProps) {
  const { title, summary, changes, onAccept, onDiscard, pending = false } = props
  const { kicker = m.chat_proposal_kicker(), mark, detail, onEdit } = props
  const [asking, setAsking] = useState(false)
  return (
    <>
      <Widget
        voice="agent"
        icon={<ListChecks />}
        mark={mark}
        kicker={kicker}
        title={title}
        {...(summary === undefined ? {} : { subtitle: summary })}
        actions={[
          // A decision on its way: the actions wait, the focus kept where it is until the hand-off.
          {
            label: m.chat_proposal_accept(),
            shortcut: { key: 'Enter', mod: true },
            waits: pending,
            onSelect: onAccept,
          },
          ...(onEdit === undefined
            ? []
            : [{ label: m.chat_proposal_edit(), waits: pending, onSelect: onEdit }]),
          {
            label: m.chat_proposal_discard(),
            apart: true,
            waits: pending,
            onSelect: () => {
              setAsking(true)
            },
          },
        ]}
      >
        {detail ??
          (changes.length === 0 ? (
            <p className="text-[0.84375rem] font-light text-muted-foreground">
              {m.chat_proposal_empty()}
            </p>
          ) : (
            <Changes changes={changes} className="text-[0.84375rem]" />
          ))}
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
    </>
  )
}
