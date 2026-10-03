// The design system on one page: every colour token as a swatch, then every ui/ component in every state.
import { createFileRoute } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import { DataGallery } from '#/ui/data/gallery'
import { FeedbackGallery } from '#/ui/feedback/gallery'
import { InputsGallery } from '#/ui/inputs/gallery'
import { OverlaysGallery } from '#/ui/overlays/gallery'
import { SurfacesGallery } from '#/ui/surfaces/gallery'
import { PageHeader } from '#/ui/surfaces/PageHeader'
import { colorTokens, type ColorToken } from '#/ui/tokens'

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
      <InputsGallery />
      <SurfacesGallery />
      <OverlaysGallery />
      <DataGallery />
      <FeedbackGallery />
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
