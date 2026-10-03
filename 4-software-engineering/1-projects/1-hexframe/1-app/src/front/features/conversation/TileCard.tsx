// A Tile inside the Conversation: its Title and its Preview, a long Preview shortened until the
// reader asks for the rest.
import { cn } from 'cn'
import { useState } from 'react'

import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/inputs/controls/button'

import { excerpt, type TileSummary } from './timeline'

/** Past this many characters, a Preview shows its start and a "show more". */
const previewLimit = 140

interface TileCardProps {
  tile: TileSummary
  /** The Tile is gone from the System: its card stays, struck through. */
  deleted?: boolean
}

export function TileCard({ tile, deleted = false }: TileCardProps) {
  const [open, setOpen] = useState(false)
  const short = excerpt(tile.preview, previewLimit)
  return (
    <article
      className={cn(
        'grid justify-items-start gap-1 rounded-lg border bg-background px-3 py-2 text-sm wrap-anywhere',
        deleted && 'opacity-70',
      )}
    >
      <h3 className={cn('font-semibold', deleted && 'line-through')}>{tile.title}</h3>
      {tile.preview !== '' && (
        <p className="text-muted-foreground">
          {open || short === undefined ? tile.preview : short}
        </p>
      )}
      {short !== undefined && (
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open)
          }}
        >
          {open ? m.conversation_show_less() : m.conversation_show_more()}
        </Button>
      )}
    </article>
  )
}
