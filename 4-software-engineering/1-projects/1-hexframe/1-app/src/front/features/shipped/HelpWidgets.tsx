// Help in the chat, at the conversation's foot, on ui's help widget: a topic of Help, read in the
// page's language, its hex its parent's frame with the topic lit, its page as written, and the topics
// it reads on to. A place picked on the map turns the page; a topic it reads on, as any mention,
// centers the canvas on it, Help, as Open in Help does the topic itself. Which topic is open is the
// URL's (`search.ts`); the route navigates.
import { useMemo } from 'react'

import { useShipped } from '#/front/client/mapping/queries'
import { getLocale } from '#/paraglide/runtime'
import { HelpWidget } from '#/front/ui/chat/widgets/help/HelpWidget'

import { helpNodeOf, readingOf } from './nodes'
import { topicOf } from './search'

interface HelpWidgetsProps {
  /** The topic open, by its id, or `true`, Help's Root. */
  topic: string | true
  /** Turns the widget to a topic and, `center`, centers the canvas on it. */
  onTopic: (id: string, center: boolean) => void
  onDismiss: () => void
}

/** The help widget, open on a topic of Help. */
export function HelpWidgets({ topic, onTopic, onDismiss }: HelpWidgetsProps) {
  // The page's language, from its URL: Help's ids are the same in every language, so the topic holds.
  const { data } = useShipped('help', getLocale())
  const help = useMemo(() => (data === undefined ? undefined : helpNodeOf(data)), [data])
  if (help === undefined) return null
  const {
    topic: read,
    path,
    frame,
    readOn,
  } = readingOf(help, topicOf({ help: topic }, help.id) ?? help.id)
  return (
    <HelpWidget
      state="topic"
      title={read.title}
      preview={read.preview}
      body={read.body}
      path={path}
      frame={{ titles: frame.titles, lit: frame.lit }}
      onPlace={(place) => {
        const id = frame.ids[place]
        if (id !== undefined) onTopic(id, false)
      }}
      readOn={readOn}
      onReadOn={(id) => {
        onTopic(id, true)
      }}
      onOpenInHelp={() => {
        onTopic(read.id, true)
      }}
      onDismiss={onDismiss}
    />
  )
}
