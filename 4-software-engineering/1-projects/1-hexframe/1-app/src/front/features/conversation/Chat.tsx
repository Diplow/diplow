// The chat on home: the Account's own Conversation, read a day at a time, today first and each earlier
// day holding an Entry as the reader asks for it, and the input, whose Message the route posts after
// the navigation it follows. Shown inside a ReadBoundary, which a failed read lands in.
import { useConversation } from '#/front/client/assistant/conversation'
import { Skeleton } from '#/front/ui/feedback/skeleton'

import { Conversation } from './Conversation'
import { dayOf } from './timeline/timeline'

interface ChatProps {
  /** A Message the user sent, trimmed and never empty. */
  onSend: (text: string) => void
  className?: string
}

export function Chat({ onSend, className }: ChatProps) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useConversation()
  if (data === undefined) return <Skeleton className={className} />
  const now = new Date()
  // The pages come today first; the timeline reads oldest first.
  const days = data.pages.map(({ day, entries, titles }) =>
    dayOf({ date: day.date, entries, titles }, now),
  )
  return (
    <Conversation
      days={days.toReversed()}
      onSend={onSend}
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
