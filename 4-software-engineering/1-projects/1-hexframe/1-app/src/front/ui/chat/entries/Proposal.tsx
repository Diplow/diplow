// What the agent proposes in ask: a zone in the flow of messages, a solid surface with one hairline on
// top and below, tinted violet toward the curve, since it is the agent's. Its hex, a kicker saying who
// proposes, the title in Newsreader, then each change on a line, its icon in violet, and the actions:
// Accept, in the agent's voice, Discard at the far end, asked first. Once decided the zone gives its
// surface back and leaves its receipt, with the Undo while one is possible. Decided from the zone, the
// focus moves to the receipt, so the keyboard never falls back to the top of the page; decided
// elsewhere, in another tab or by a poll, the focus stays where the user is and a status says it.
import { cn } from 'cn'
import type { LucideIcon } from 'lucide-react'
import { ListChecks } from 'lucide-react'
import { type FocusEvent, useState } from 'react'

import { m } from '#/paraglide/messages'

import { ConfirmDialog } from '../../layouts/ConfirmDialog'
import { Act } from '../atoms/Act'
import { HexMark } from '../atoms/hex'
import { Said, type Words } from '../text/words'
import { Receipt } from './Receipt'

/** One change the Proposal would make: its verb's icon and what it does. */
export interface Change {
  icon: LucideIcon
  words: Words
}

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
  const { title, fate, at, undone = false, onUndo, pending = false } = props
  const decided =
    fate === 'accepted' ? m.chat_proposal_accepted({ title }) : m.chat_proposal_discarded({ title })
  // Whether the focus is in the zone, whether the receipt takes it, and what the status says, each set
  // as the fate moves: the receipt takes the focus the zone had, else the status says the decision.
  const [shown, setShown] = useState(fate)
  const [focused, setFocused] = useState(false)
  const [handOff, setHandOff] = useState(false)
  const [status, setStatus] = useState('')
  if (shown !== fate) {
    setShown(fate)
    setHandOff(shown === 'open' && focused)
    setFocused(false)
    setStatus(shown === 'open' && !focused ? decided : '')
  }
  return (
    <>
      {fate === 'open' ? (
        <Zone
          {...props}
          onFocus={() => {
            setFocused(true)
          }}
          onBlur={(event) => {
            // The focus left for good, not for the dialog Discard opens, which focuses within it next.
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
          }}
        />
      ) : (
        <Receipt
          takesFocus={handOff}
          words={[decided]}
          at={at}
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

interface ZoneProps extends ProposalProps {
  onFocus: () => void
  onBlur: (event: FocusEvent<HTMLElement>) => void
}

function Zone(props: ZoneProps) {
  const { title, summary, changes, onAccept, onDiscard, pending = false, onFocus, onBlur } = props
  return (
    <section
      aria-label={m.chat_proposal_label()}
      onFocus={onFocus}
      onBlur={onBlur}
      className={cn(
        'relative grid grid-cols-[minmax(0,1fr)] gap-x-4.5 bg-card bg-linear-to-r from-transparent from-15% to-agent/9 px-4 py-5 sm:grid-cols-[3.375rem_minmax(0,1fr)] sm:px-9',
        // A hairline on top and below, fading in from the left, as every zone's.
        'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-input before:via-45% before:to-input',
        'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-linear-to-r after:from-transparent after:via-input after:via-45% after:to-input',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 animation-duration-500 ease-glide',
      )}
    >
      <span className="relative mt-0.5 hidden h-[3.125rem] w-[3.375rem] text-agent sm:block">
        <HexMark className="absolute inset-0 size-full fill-agent/7 stroke-agent/55" />
        <ListChecks
          aria-hidden
          strokeWidth={1.3}
          className="absolute top-1/2 left-1/2 size-[1.1875rem] -translate-1/2"
        />
      </span>
      <div className="min-w-0">
        <p className="font-agent text-[0.71875rem] leading-normal text-agent">
          {m.chat_proposal_kicker()}
        </p>
        <p className="mt-px font-human text-[1.3125rem] leading-tight text-foreground">{title}</p>
        {summary !== undefined && (
          <p className="mt-1 text-[0.84375rem] font-light text-muted-foreground">{summary}</p>
        )}
        {changes.length === 0 ? (
          <p className="mt-4 text-[0.84375rem] font-light text-muted-foreground">
            {m.chat_proposal_empty()}
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {changes.map(({ icon: Icon, words }, index) => (
              // The changes of one Proposal, never reordered: their place is their key.
              <li
                key={index}
                className="grid grid-cols-[0.875rem_minmax(0,1fr)] gap-2.5 text-[0.84375rem] leading-snug font-light text-muted-foreground"
              >
                <Icon aria-hidden strokeWidth={1.4} className="mt-0.5 size-3.5 text-agent" />
                <span className="wrap-anywhere">
                  <Said words={words} voice="agent" />
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4.5 flex flex-wrap items-center gap-x-5.5 gap-y-1">
          <Act tone="agent" disabled={pending} onClick={onAccept}>
            {m.chat_proposal_accept()}
          </Act>
          <ConfirmDialog
            trigger={
              <Act className="ml-auto" disabled={pending}>
                {m.chat_proposal_discard()}
              </Act>
            }
            title={m.chat_proposal_discard_title()}
            description={m.chat_proposal_discard_description()}
            confirmLabel={m.chat_proposal_discard()}
            destructive
            onConfirm={onDiscard}
          />
        </div>
      </div>
    </section>
  )
}
