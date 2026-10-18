// What the timeline draws of its Entries, a block at a time (`./words.ts`): a run of lines on the
// thread of what happened, by who acted (`Events`); a Message in its voice, the user's or the agent's,
// its links woven in as the Tiles they name, a run of the agent's marked on its first only
// (`Message`); a Proposal, which the user accepts or discards, then may undo (`./Proposal.tsx`); and
// what a Turn in apply wrote, the receipt it leaves with its Undo, then undone (`Receipt`); and a
// change someone else made in the user's System, by who of theirs acted, from outside, its Undo
// offered once, then undone (`Receipt`, quiet); and someone asking to join an Organization the user
// is an admin of, Accept and Decline offered while it is open, then how it was decided, by this admin
// or another (`Receipt`, quiet, HEX-138).
import { offersUndo } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { Events } from '#/front/ui/chat/entries/Events'
import { Receipt } from '#/front/ui/chat/entries/Receipt'
import { Message } from '#/front/ui/chat/text/Message'

import type { Deciding, Joining } from './parts'
import { ProposalEntry } from './Proposal'
import {
  type Block,
  changeWords,
  happenedOf,
  joinAskedWords,
  messageWords,
  type Naming,
} from './words'

interface BlockProps {
  block: Block
  naming: Naming
  /** Accepts or discards an open Proposal, and undoes what was applied. */
  decide: Deciding
  /** Accepts or declines a request to join, as it stands now. */
  joining: Joining
}

/** How a request to join was decided, said after its line. */
const decided = {
  accepted: m.conversation_join_was_accepted,
  declined: m.conversation_join_was_declined,
}

export function EntryBlock({ block, naming, decide, joining }: BlockProps) {
  switch (block.kind) {
    case 'lines':
      return <Events lines={block.entries.map((entry) => happenedOf(entry, naming))} />
    case 'message': {
      const words = messageWords(block.entry.text, naming)
      return block.entry.author === 'user' ? (
        <Message voice="human" words={words} />
      ) : (
        <Message voice="agent" words={words} continued={block.continued} />
      )
    }
    case 'proposal':
      return <ProposalEntry entry={block.entry} naming={naming} decide={decide} />
    case 'theirs': {
      const { entry } = block
      return (
        <Receipt
          words={changeWords(entry, naming)}
          at={entry.at}
          tone="quiet"
          undone={entry.undone}
          onUndo={
            offersUndo(entry)
              ? () => {
                  decide.undo(entry.id)
                }
              : undefined
          }
          pending={decide.pending}
        />
      )
    }
    case 'asked': {
      const { entry } = block
      const state = joining.states[entry.request]
      return (
        <Receipt
          words={joinAskedWords(entry, naming)}
          at={entry.at}
          tone="quiet"
          said={state === undefined || state === 'open' ? undefined : decided[state]()}
          actions={
            state === 'open'
              ? [
                  {
                    label: m.conversation_join_accept(),
                    onSelect: () => {
                      joining.decide(entry.request, true)
                    },
                  },
                  {
                    label: m.conversation_join_decline(),
                    onSelect: () => {
                      joining.decide(entry.request, false)
                    },
                  },
                ]
              : undefined
          }
          pending={joining.pending}
        />
      )
    }
    case 'applied': {
      const { entry } = block
      return (
        <Receipt
          words={[
            entry.changes === 1
              ? m.conversation_applied_title_one()
              : m.conversation_applied_title({ count: entry.changes }),
          ]}
          at={entry.at}
          undone={entry.undone}
          onUndo={
            offersUndo(entry)
              ? () => {
                  decide.undo(entry.turn)
                }
              : undefined
          }
          pending={decide.pending}
        />
      )
    }
  }
}
