// A tile's page: its title, its preview and its body whole, the body read as Markdown, in place of its
// hex over the whole canvas, which grows out of the hex as it comes and goes back into it as it leaves
// (`usePageZoom`). It takes the focus as it comes, so the keyboard scrolls it at once; Escape leaves
// it, as the C key does.
import type { RefCallback } from 'react'
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import { CodeBlock, Markdown } from '../../../seams/Markdown'
import type { TileNode } from '../../view/tiles'

interface PageProps {
  tile: TileNode
  /** The page's element, which its zoom plays on and focuses as it comes (`usePageZoom`'s `page`). */
  page: RefCallback<HTMLElement>
  /** Escape: the page leaves, back into the tile's hex. */
  onLeave: () => void
  className?: string
}

export function Page({ tile, page, onLeave, className }: PageProps) {
  const body = tile.body ?? ''
  return (
    <article
      ref={page}
      tabIndex={-1}
      aria-label={m.page_label({ title: tile.title })}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return
        event.preventDefault()
        onLeave()
      }}
      className={cn(
        'absolute inset-0 origin-top-left overflow-y-auto bg-linear-to-b from-tile to-tile-fade ease-camera outline-none',
        className,
      )}
    >
      <div className="mx-auto grid max-w-[68ch] gap-4 px-8 pt-12 pb-16 pointer-coarse:px-5">
        <h1 className="font-human text-3xl leading-tight font-light text-foreground">
          {tile.title}
        </h1>
        {tile.preview !== '' && (
          <p className="font-human text-lg leading-normal font-light text-muted-foreground">
            {tile.preview}
          </p>
        )}
        <hr className="my-2 border-border" />
        {body === '' ? (
          <p className="text-sm text-muted-foreground">{m.page_nothing_yet()}</p>
        ) : tile.file === true ? (
          <CodeBlock code={body} label={tile.title} className="max-h-none" />
        ) : (
          <Markdown text={body} />
        )}
        <p className="mt-6 text-xs text-faint">{m.page_leave_hint()}</p>
      </div>
    </article>
  )
}
