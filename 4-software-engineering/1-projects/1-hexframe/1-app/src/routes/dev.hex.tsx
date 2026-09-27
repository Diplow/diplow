// The hex canvas on a fixture System, its view in the search params: a link shows what its sender saw.
import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import { Canvas } from '#/ui/hex/Canvas'
import { fixtureViews, ulysse } from '#/ui/hex/fixtures'
import { readCanvasView } from '#/ui/hex/view/view'
import { PageHeader } from '#/ui/surfaces/PageHeader'

export const Route = createFileRoute('/dev/hex')({
  // A dev page, like /dev/ui: production answers 404 (vite.config.ts).
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's notFound() is meant to be thrown; the router catches it
    if (!__DEV_PAGES__) throw notFound()
  },
  validateSearch: readCanvasView,
  component: HexCanvas,
})

/** The label of each fixture view; the views themselves are the fixture's, so they cannot drift. */
const views = [
  { label: m.dev_hex_view_root, view: fixtureViews.root },
  { label: m.dev_hex_view_expanded, view: fixtureViews.expanded },
  { label: m.dev_hex_view_nested, view: fixtureViews.nested },
  { label: m.dev_hex_view_context, view: fixtureViews.context },
  { label: m.dev_hex_view_centered, view: fixtureViews.centered },
]

function HexCanvas() {
  const view = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <main className="flex flex-col items-center gap-4 px-6 pb-6">
      <div className="grid w-full max-w-5xl gap-4">
        <PageHeader title={m.dev_hex_title()} description={m.dev_hex_description()} />
        <nav aria-label={m.dev_hex_views()} className="flex flex-wrap gap-2">
          {views.map(({ label, view: target }) => (
            <Link
              key={label()}
              to="/dev/hex"
              search={target}
              activeOptions={{ exact: true, includeSearch: true }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
              activeProps={{ className: 'bg-muted text-foreground' }}
            >
              {label()}
            </Link>
          ))}
        </nav>
      </div>
      <Canvas
        system={ulysse}
        view={view}
        onViewChange={(next) => {
          void navigate({ search: next })
        }}
        className="h-[calc(100dvh-16rem)] max-w-full"
      />
    </main>
  )
}
