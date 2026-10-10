// The chat on home: the Account's own Conversation, read a day at a time, today first and each earlier
// day holding an Entry as the reader asks for it, and the input, whose Message the route posts after
// the navigation it follows, saying so when the Account may not use the Assistant. While a Turn runs,
// as the route's poll last saw it, the input waits, and the agent's step shows beside a Stop. Shown
// inside a ReadBoundary, which a failed read lands in.
import {
  useAssistantAvailable,
  useConversation,
  useStopTurn,
} from '#/front/client/assistant/conversation'
import type { LiveTurn } from '#/front/client/assistant/follow'
import { Skeleton } from '#/front/ui/feedback/skeleton'

import { Conversation } from './Conversation'
import { dayOf } from './timeline/timeline'

interface ChatProps {
  /** A Message the user sent, trimmed and never empty; none while nothing can be sent yet. */
  onSend: ((text: string) => void) | undefined
  /** The Turn running, as the page's poll last saw it. */
  turn: LiveTurn | undefined
  className?: string
}

export function Chat({ onSend, turn, className }: ChatProps) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useConversation()
  const { data: available } = useAssistantAvailable()
  const { mutate: stop, isPending: stopping } = useStopTurn()
  if (data === undefined) return <Skeleton className={className} />
  const now = new Date()
  // The pages come today first; the timeline reads oldest first.
  const days = data.pages.map(({ day, entries, titles }) =>
    dayOf({ date: day.date, entries, titles }, now),
  )
  return (
    <Conversation
      days={days.toReversed()}
      onSend={(text) => onSend?.(text)}
      // Until it is read, or when reading it failed, the composer says nothing either way.
      unavailable={available === false}
      running={
        turn === undefined
          ? undefined
          : {
              step: turn.step,
              stop: () => {
                stop()
              },
              stopping,
            }
      }
      waiting={onSend === undefined}
      earlier={
        hasNextPage
          ? {
              show: () => {
                void fetchNextPage()
              },
              pending: isFetchingNextPage,
            }
          : undefined
      }
      className={className}
    />
  )
}
