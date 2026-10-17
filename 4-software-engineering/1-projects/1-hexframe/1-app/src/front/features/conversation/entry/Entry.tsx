// What the timeline draws of its Entries, a block at a time (`./words.ts`): a run of lines on the
// thread of what happened, by who acted (`Events`); a Message in its voice, the user's or the agent's,
// its links woven in as the Tiles they name, a run of the agent's marked on its first only
// (`Message`); a Proposal, which the user accepts or discards, then may undo (`./Proposal.tsx`); and
// what a Turn in apply wrote, the receipt it leaves with its Undo, then undone (`Receipt`).
import { offersUndo } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { Events } from '#/front/ui/chat/entries/Events'
import { Receipt } from '#/front/ui/chat/entries/Receipt'
import { Message } from '#/front/ui/chat/text/Message'

import type { Deciding } from './parts'
import { ProposalEntry } from './Proposal'
import { type Block, happenedOf, messageWords, type Naming } from './words'

interface BlockProps {
  block: Block
  naming: Naming
  /** Accepts or discards an open Proposal, and undoes what was applied. */
  decide: Deciding
}

export function EntryBlock({ block, naming, decide }: BlockProps) {
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
