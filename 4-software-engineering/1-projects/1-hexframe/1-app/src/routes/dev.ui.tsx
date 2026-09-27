// Every colour token in the theme, as a swatch: what a ui/ component colours itself with.
import { createFileRoute, notFound } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import { colorTokens, type ColorToken } from '#/ui/tokens'

import css from '../styles.css?raw'

const tokens = colorTokens(css)

export const Route = createFileRoute('/dev/ui')({
  // A dev page: a production build answers 404.
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's notFound() is meant to be thrown; the router catches it
    if (!import.meta.env.DEV) throw notFound()
  },
  component: Gallery,
})

function Gallery() {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-12">
      <h1 className="text-2xl font-semibold tracking-tight">{m.dev_ui_tokens_title()}</h1>
      <p className="mt-2 text-muted-foreground">{m.dev_ui_tokens_body()}</p>
      <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
        {tokens.map((token) => (
          <Swatch key={token.name} token={token} />
        ))}
      </ul>
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
