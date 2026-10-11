// The seams, on /design-system: the Markdown one, which shows a Body that isn't Markdown as code for now.
import { m } from '#/paraglide/messages'

import { GallerySection, GalleryState } from '../gallery/frame'
import { CodeBlock } from './Markdown'

export function SeamsGallery() {
  return (
    <GallerySection name="CodeBlock">
      <GalleryState label={m.gallery_state_verbatim_file()}>
        <CodeBlock code={sampleCode} label="run.yaml" className="w-[28rem]" />
      </GalleryState>
    </GallerySection>
  )
}

// A file that isn't Markdown, as a Leaf keeps it: a line longer than the box scrolls.
const sampleCode = `version: 1
team: Hexframe
gates:
  unit:
    - pnpm --dir 4-software-engineering/1-projects/1-hexframe install --frozen-lockfile
    - pnpm --dir 4-software-engineering/1-projects/1-hexframe check
`
