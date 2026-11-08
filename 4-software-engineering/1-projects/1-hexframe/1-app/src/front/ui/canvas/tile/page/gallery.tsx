// A tile's page on /design-system: a body read as Markdown, a Leaf that isn't Markdown, and a tile
// with nothing written yet, each held still in a frame the size of a small canvas. Its zoom plays on
// the canvas's own specimen, which the C key cycles. The tile's words are the user's, so not
// translated, as the fixture System's are.
import { m } from '#/paraglide/messages'

import { GallerySection, GalleryState } from '../../../gallery/frame'
import { tooling } from '../../fixtures'
import type { TileNode } from '../../view/tiles'
import { Page } from './Page'

const written: TileNode = {
  ...tooling,
  body: `## What I reach for

- **TanStack Start**, for the app, client and server in one place.
- **Effect**, so every error has a type and a channel.
- **Claude Code**, which unfolds its work on the canvas.

> Pick the tool that keeps the next reader's mental model small.

Each choice has its reason in \`STACK.md\`.`,
}

const file: TileNode = {
  id: 'run',
  title: 'run.yaml',
  preview: '',
  leaf: true,
  file: true,
  body: `version: 1
team: Hexframe
gates:
  unit:
    - pnpm check`,
}

const samples = [
  { label: m.gallery_state_page_markdown, tile: written },
  { label: m.gallery_state_page_file, tile: file },
  { label: m.gallery_state_page_empty, tile: tooling },
]

/** The page held still: no element to zoom, nothing to leave. */
const still = () => undefined

export function PageGallery() {
  return (
    <GallerySection name="Page">
      {samples.map(({ label, tile }) => (
        <GalleryState key={tile.id + label()} label={label()}>
          <div className="relative h-96 w-[36rem] overflow-hidden rounded-md">
            <Page tile={tile} page={still} onLeave={still} />
          </div>
        </GalleryState>
      ))}
    </GallerySection>
  )
}
