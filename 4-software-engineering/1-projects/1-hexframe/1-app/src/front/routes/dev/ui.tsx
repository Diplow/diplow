// The design system on one page: every colour token as a swatch, then every ui/ component in every state,
// tier by tier, the shared atoms and layouts first, then each side's own, then the seams.
import { createFileRoute } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import { AtomsGallery } from '#/front/ui/atoms/gallery'
import { CanvasAtomsGallery } from '#/front/ui/canvas/atoms/gallery'
import { CanvasLayoutsGallery } from '#/front/ui/canvas/layouts/gallery'
import { ChatAtomsGallery } from '#/front/ui/chat/atoms/gallery'
import { LayoutsGallery } from '#/front/ui/layouts/gallery'
import { PageHeader } from '#/front/ui/layouts/PageHeader'
import { SeamsGallery } from '#/front/ui/seams/gallery'
import { colorTokens, type ColorToken } from '#/front/ui/tokens'

import css from '../../styles.css?raw'

const tokens = colorTokens(css)

export const Route = createFileRoute('/dev/ui')({
  component: Gallery,
})

function Gallery() {
  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-6 pb-12">
      <PageHeader title={m.dev_ui_title()} description={m.dev_ui_description()} />
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">{m.dev_ui_tokens_title()}</h2>
        <p className="text-muted-foreground">{m.dev_ui_tokens_body()}</p>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
          {tokens.map((token) => (
            <Swatch key={token.name} token={token} />
          ))}
        </ul>
      </section>
      <AtomsGallery />
      <LayoutsGallery />
      <ChatAtomsGallery />
      <CanvasAtomsGallery />
      <CanvasLayoutsGallery />
      <SeamsGallery />
    </main>
  )
}

function Swatch({ token: { name, foreground } }: { token: ColorToken }) {
  return (
    <li className="overflow-hidden rounded-lg border">
      <div
        className="flex h-20 items-center justify-center text-2xl font-semibold"
        // `@theme inline` defines no `--color-*` variable, so a swatch reads the variable behind the token.
        style={{ background: `var(--${name})`, color: foreground && `var(--${foreground})` }}
      >
        {foreground && 'Aa'}
      </div>
      <div className="border-t p-3 font-mono text-xs">
        <p>--{name}</p>
        {foreground && <p className="text-muted-foreground">--{foreground}</p>}
      </div>
    </li>
  )
}
