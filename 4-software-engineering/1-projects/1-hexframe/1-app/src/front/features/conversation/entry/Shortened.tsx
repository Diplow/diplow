// A Message too long to show whole inside the timeline: its first 800 characters, cut at a word, its
// links counted as the Titles they show, until the reader asks for the rest.
import { type ReactNode, useState } from 'react'

import type { MessagePart } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/inputs/controls/button'

import { excerptOf } from '../timeline/timeline'

/** Past this many characters, a Message shows its start and a "show more". */
const limit = 800

interface ShortenedProps {
  parts: ReadonlyArray<MessagePart>
  /** What a link shows, `@` and its Tile's Title. */
  shown: (tile: string) => string
  /** The pieces drawn. */
  children: (parts: ReadonlyArray<MessagePart>) => ReactNode
}

export function Shortened({ parts, shown, children }: ShortenedProps) {
  const [open, setOpen] = useState(false)
  const short = excerptOf(parts, shown, limit)
  return (
    <>
      <span>{children(open || short === undefined ? parts : short)}</span>
      {short !== undefined && (
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0 text-inherit"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open)
          }}
        >
          {open ? m.conversation_show_less() : m.conversation_show_more()}
        </Button>
      )}
    </>
  )
}
