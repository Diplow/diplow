// A text too long to show whole inside the timeline, a long Message: its start, cut at a word, until
// the reader asks for the rest.
import { useState } from 'react'

import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/inputs/controls/button'

import { excerpt } from '../timeline/timeline'

interface ShortenedProps {
  text: string
  /** Past this many characters, the text shows its start and a "show more". */
  limit: number
}

export function Shortened({ text, limit }: ShortenedProps) {
  const [open, setOpen] = useState(false)
  const short = excerpt(text, limit)
  return (
    <>
      <span>{open || short === undefined ? text : short}</span>
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
