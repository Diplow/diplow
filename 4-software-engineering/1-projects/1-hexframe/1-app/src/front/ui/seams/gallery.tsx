// The seams, on /design-system: the Markdown one, a Body read as Markdown, and one that isn't Markdown
// shown as code.
import { m } from '#/paraglide/messages'

import { GallerySection, GalleryState } from '../gallery/frame'
import { CodeBlock, Markdown } from './Markdown'

export function SeamsGallery() {
  return (
    <>
      <GallerySection name="Markdown">
        <GalleryState label={m.gallery_state_markdown_body()}>
          <Markdown text={sampleMarkdown} className="w-[32rem]" />
        </GalleryState>
      </GallerySection>
      <GallerySection name="CodeBlock">
        <GalleryState label={m.gallery_state_verbatim_file()}>
          <CodeBlock code={sampleCode} label="run.yaml" className="w-[28rem]" />
        </GalleryState>
      </GallerySection>
    </>
  )
}

// A Body as a user writes one, in their words, so not translated.
const sampleMarkdown = `# Leadership

What I believe a team needs, **first**:

1. A direction it can repeat.
2. The room to disagree.

> A plan nobody can argue with is a plan nobody read.

Run \`pnpm check\` before you ask for a review.`

// A file that isn't Markdown, as a Leaf keeps it: a line longer than the box scrolls.
const sampleCode = `version: 1
team: Hexframe
gates:
  unit:
    - pnpm --dir 4-software-engineering/1-projects/1-hexframe install --frozen-lockfile
    - pnpm --dir 4-software-engineering/1-projects/1-hexframe check
`
