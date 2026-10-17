// The agent's invitation to a new account's first command on home (HEX-118): `useInvited`, whether
// the chat invites it now, which the composer reads too, to offer `/tutorial` first, and
// `ChatInvitation`, the agent's one line after the receipt at the conversation's foot, which the
// route places there.
import { useConversation, useMessagesOnTheirWay } from '#/front/client/assistant/conversation'
import { useSystem } from '#/front/client/mapping/queries'
import { tutorialInvitation } from '#/front/ui/chat/composer/commands'
import { Message } from '#/front/ui/chat/text/Message'

import { invitesTutorial } from './invites'

/**
 * Whether the chat invites the tutorial now (`invitesTutorial`), from the System and the days of
 * the Conversation the page holds, each read without throwing, its failure another boundary's, and
 * the Messages on their way; never before both are read.
 */
export function useInvited(): boolean {
  const { data: system } = useSystem({ throwing: false })
  const { data: conversation } = useConversation({ throwing: false })
  const { messages } = useMessagesOnTheirWay()
  const root = system?.root
  if (root === undefined || conversation === undefined) return false
  const entries = conversation.pages.flatMap((page) => page.entries)
  return invitesTutorial(root, entries, messages.length > 0)
}

interface ChatInvitationProps {
  /** `/tutorial`: the tutorial on the canvas. */
  onTutorial: () => void
  /** It comes with a new account's dawn, under the pseudo's receipt: fifth, after the composer. */
  dawning: boolean
}

/**
 * The agent's one line after the receipt at the conversation's foot, inviting a new account's first
 * command, `/tutorial`, which a click runs as typing it does: while the chat invites it, its Root
 * holding nothing and nothing said; gone once either changes.
 */
export function ChatInvitation({ onTutorial, dawning }: ChatInvitationProps) {
  const invited = useInvited()
  if (!invited) return null
  return <Message voice="agent" words={tutorialInvitation(onTutorial)} dawning={dawning} />
}
