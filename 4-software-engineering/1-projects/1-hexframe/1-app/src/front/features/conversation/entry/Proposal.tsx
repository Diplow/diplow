// A Proposal in the timeline, on the widget the proposal drew (`Proposal`, ui's `chat/entries/`): the
// changes the agent drafted in ask, each in its verb's words and icon, the Tiles named by the Titles
// Mapping gave them on the System the Proposal makes, a Tile it creates the agent's draft until it is
// accepted. While it is open the user accepts it whole or discards it, asked first; once decided it
// leaves its receipt, its changes folded under it, and once accepted its Undo, until it is undone.
import { type Entry, offersUndo } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { Proposal } from '#/front/ui/chat/entries/Proposal'

import type { Deciding } from './parts'
import { type Naming, proposedOf } from './words'

interface ProposalProps {
  entry: Extract<Entry, { _tag: 'Proposal' }>
  naming: Naming
  decide: Deciding
}

export function ProposalEntry({ entry, naming, decide }: ProposalProps) {
  const { proposal, changes, fate } = entry
  const count = changes.length
  return (
    <Proposal
      title={
        count === 1 ? m.conversation_proposal_title_one() : m.conversation_proposal_title({ count })
      }
      changes={changes.map((change) => proposedOf(change, naming, fate === 'accepted'))}
      // Assistant's own: should it grow a fate the widget cannot draw, this stops compiling.
      fate={fate}
      at={entry.at}
      undone={entry.undone === true}
      onAccept={() => {
        decide.accept(proposal)
      }}
      onDiscard={() => {
        decide.discard(proposal)
      }}
      onUndo={
        offersUndo(entry)
          ? () => {
              decide.undo(proposal)
            }
          : undefined
      }
      pending={decide.pending}
    />
  )
}
