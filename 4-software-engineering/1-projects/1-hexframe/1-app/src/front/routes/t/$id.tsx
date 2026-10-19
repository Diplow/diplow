// A link to a Tile, `/t/<id>`, the one Copy link copies (HEX-127): signed in, home's canvas on the
// System holding it, centered on it, the Account's own or someone else's as it may see it, with its
// rights. Signed out, a Tile Everyone may read opens here on a canvas of its own, read-only, centered
// on it, the corner from its star, as anyone holding the link sees its System: no chat, no composer,
// no Tile's menu, only a way to sign in or sign up, which comes back here (HEX-129). A Tile no one
// may show the reader, kept from them or gone, is the same 404, "nothing to see here". No page of it
// is indexed. The view is the URL's, as on home.
import { createFileRoute, Link, notFound, redirect } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { useMemo } from 'react'

import { hexframeStar } from '#/domains/mapping/entities'
import { sessionIfAny } from '#/front/client/iam/guard'
import { leadsTo, publicSystemOf } from '#/front/client/mapping/queries'
import { Breadcrumb } from '#/front/features/breadcrumb/Breadcrumb'
import { pinFollowed, publicTree, withVisit } from '#/front/features/system/visit/visit'
import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/atoms/controls/button'
import { Canvas } from '#/front/ui/canvas/Canvas'
import {
  centerOn,
  readCanvasView,
  viewIn,
  type CanvasView,
  type ViewAction,
} from '#/front/ui/canvas/view/view'
import type { Sun } from '#/front/ui/canvas/view/tiles'
import { cornerPlace } from '#/front/ui/layouts/screen/Screen'
import { EmptyState } from '#/front/ui/layouts/states'

export const Route = createFileRoute('/t/$id')({
  validateSearch: readCanvasView,
  beforeLoad: sessionIfAny,
  // The router's redirects and its 404 are thrown (`throw: true`), as the old pages' are.
  loader: async ({ params: { id }, context: { session } }) => {
    if (session !== undefined) return visited(id)
    return (await publicSystemOf(id)) ?? missing()
  },
  // Read once per link: a gesture changes the search alone, which reads nothing again.
  shouldReload: false,
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }] }),
  component: Public,
  notFoundComponent: Missing,
})

/**
 * Signed in, where the link leads the Account: home visiting the System holding the Tile, centered on
 * it, or the 404 for a Tile it may not read. Never comes back.
 */
async function visited(id: string): Promise<never> {
  const led = (await leadsTo(id)) ?? missing()
  redirect({
    to: '/',
    search: { ...withVisit(led.system), center: id },
    replace: true,
    throw: true,
  })
  return thrown()
}

/** The page's 404, thrown by the router: a Tile no one may show the reader. */
function missing(): never {
  notFound({ throw: true })
  return thrown()
}

/** What the type can't see: the router has thrown the redirect or the 404 it was handed by now. */
function thrown(): never {
  throw new Error('The router throws what it is handed with `throw: true`')
}

/** Where signing in or up goes back to: this page, which then leads the Account on. */
const backHere = (id: string) => `/t/${encodeURIComponent(id)}`

/**
 * A public Tile, signed out: its System as anyone may see it, from its star's card, on the canvas,
 * centered on it until the reader moves, each Tile's hover card alone; the corner from the star; and
 * at the foot, what this is and the way to sign in or up.
 */
function Public() {
  const { id } = Route.useParams()
  const seen = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const tree = useMemo(() => publicTree(seen), [seen])
  const view = search.center === undefined ? centerOn(tree, id) : viewIn(search)
  // A view's center absent is the star; here it is the Tile linked, so the star is named outright.
  // A pin followed leads to the Tile of the other System, by its own link.
  const onViewChange = (next: CanvasView, action: ViewAction) => {
    const pin = pinFollowed(seen.pinned, action)
    if (pin !== undefined) void navigate({ to: '/t/$id', params: { id: pin }, search: {} })
    else void navigate({ search: { ...next, center: next.center ?? tree.id } })
  }
  // The star glows amber, a person's, or rose, hexframe's own Organization's; the corner with it.
  const sun: Sun = { light: tree.id === hexframeStar ? 'organization' : 'human' }
  return (
    <main className="relative h-dvh overflow-hidden">
      <h1 className="sr-only">{m.public_title()}</h1>
      <Canvas
        system={tree}
        cycles
        view={view}
        onViewChange={onViewChange}
        looking="card"
        sun={sun}
        className="size-full"
      />
      <div className={cornerPlace}>
        <Breadcrumb system={tree} view={view} onViewChange={onViewChange} sun={sun} />
      </div>
      <footer className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 p-4">
        <p className="text-sm text-muted-foreground">{m.public_shared()}</p>
        <Button asChild variant="outline">
          <Link to="/" search={{ redirect: backHere(id) }}>
            {m.public_sign_in()}
          </Link>
        </Button>
        <Button asChild>
          <Link to="/" search={{ access: 'sign-up', redirect: backHere(id) }}>
            {m.public_sign_up()}
          </Link>
        </Button>
      </footer>
    </main>
  )
}

/**
 * A Tile no one may show the reader: kept from them or gone, it can't tell. Signed in, the way home;
 * signed out, the way to sign in, which comes back here, where a Tile the Account may read leads on.
 */
function Missing() {
  const { session } = Route.useRouteContext()
  const { id } = Route.useParams()
  return (
    <main className="grid h-dvh place-items-center p-6">
      <EmptyState
        icon={<SearchX />}
        title={m.visit_missing_title()}
        description={m.error_mapping_tile_not_found()}
        action={
          <Button asChild variant="outline">
            {session === undefined ? (
              <Link to="/" search={{ redirect: backHere(id) }}>
                {m.visit_missing_sign_in()}
              </Link>
            ) : (
              <Link to="/">{m.visit_missing_home()}</Link>
            )}
          </Button>
        }
      />
    </main>
  )
}
