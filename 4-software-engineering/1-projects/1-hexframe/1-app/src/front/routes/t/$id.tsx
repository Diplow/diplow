// A link to a Tile, `/t/<id>`, the one Copy link copies (HEX-127): signed in, home's canvas on the
// System holding it, centered on it, the Account's own or someone else's as it may see it; a Tile it
// may not read is the same "nothing to see here" as one that doesn't exist. Signed out, home's
// sign-in, which comes back here once signed in (a Tile Everyone reads, served to anyone, is HEX-129).
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'

import { sessionIfAny } from '#/front/client/iam/guard'
import { leadsTo } from '#/front/client/mapping/queries'
import { withVisit } from '#/front/features/system/visit/visit'
import { m } from '#/paraglide/messages'
import { Button } from '#/front/ui/atoms/controls/button'
import { EmptyState } from '#/front/ui/layouts/states'

export const Route = createFileRoute('/t/$id')({
  beforeLoad: async ({ params: { id } }) => {
    const { session } = await sessionIfAny()
    if (session === undefined) {
      redirect({
        to: '/',
        search: { redirect: `/t/${encodeURIComponent(id)}` },
        replace: true,
        throw: true,
      })
    }
    const led = await leadsTo(id)
    if (led === undefined) return { missing: true }
    redirect({
      to: '/',
      search: { ...withVisit(led.system), center: id },
      replace: true,
      throw: true,
    })
    return { missing: false }
  },
  component: Missing,
})

/** A Tile no one may show the Account: kept from it or gone, it can't tell, and the way home. */
function Missing() {
  return (
    <main className="grid h-dvh place-items-center p-6">
      <EmptyState
        icon={<SearchX />}
        title={m.visit_missing_title()}
        description={m.error_mapping_tile_not_found()}
        action={
          <Button asChild variant="outline">
            <Link to="/">{m.visit_missing_home()}</Link>
          </Button>
        }
      />
    </main>
  )
}
