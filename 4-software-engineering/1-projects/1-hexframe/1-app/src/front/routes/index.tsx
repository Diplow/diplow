// Home: the signed-in Account's System, on the canvas, with the centered Tile's actions and its
// ancestors beside it. The view and the change under way live in the search params, so a link shows
// what its sender saw; every gesture that changes the view is published on the client bus as a
// navigation fact, for the Conversation to record. Signed out, the guard sends the visit to sign-in,
// then back here. The page follows the System, so a write it did not make, an agent's, a Key's or
// another tab's, shows once the tab regains focus.
import { createFileRoute } from '@tanstack/react-router'

import { ReadBoundary } from '#/front/client/ReadBoundary'
import { signedInOnly } from '#/front/client/iam/guard'
import { useFollowSystem } from '#/front/client/mapping/follow'
import { useSystem } from '#/front/client/mapping/queries'
import { Breadcrumb } from '#/front/features/breadcrumb/Breadcrumb'
import { publish } from '#/front/features/bus'
import { Navigated } from '#/front/features/facts'
import {
  readSystemSearch,
  viewOf,
  withView,
  type SearchChange,
  type SystemSearch,
} from '#/front/features/system/search/search'
import { System } from '#/front/features/system/System'
import { TileActions } from '#/front/features/system/TileActions'
import { canvasTree } from '#/front/features/system/tree'
import { m } from '#/paraglide/messages'
import { Skeleton } from '#/front/ui/feedback/skeleton'
import type { CanvasView, ViewAction } from '#/front/ui/hex/view/view'

export const Route = createFileRoute('/')({
  beforeLoad: signedInOnly,
  validateSearch: readSystemSearch,
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const onSearchChange = (next: SearchChange) => {
    void navigate({ search: next })
  }
  return (
    <main className="grid gap-4 px-4 pb-4 lg:h-[calc(100dvh-4.25rem)] lg:grid-cols-[minmax(0,1fr)_18rem]">
      <h1 className="sr-only">{m.system_title()}</h1>
      <ReadBoundary>
        <SystemPage search={search} onSearchChange={onSearchChange} />
      </ReadBoundary>
    </main>
  )
}

interface SystemPageProps {
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
}

function SystemPage({ search, onSearchChange }: SystemPageProps) {
  const { data } = useSystem()
  // Nothing follows it closely yet: a Turn will, while it runs.
  useFollowSystem({ closely: false })
  if (data === undefined) {
    return (
      <>
        <Skeleton className="h-[60dvh] lg:h-full" />
        <Skeleton className="h-40" />
      </>
    )
  }
  const { system, root } = data
  const tree = canvasTree(root)
  const onViewChange = (view: CanvasView, action: ViewAction) => {
    onSearchChange(withView(search, view))
    publish(new Navigated(action))
  }
  return (
    <>
      <System
        system={system}
        tree={tree}
        search={search}
        onViewChange={onViewChange}
        onSearchChange={onSearchChange}
        className="h-[80dvh] min-h-0 lg:h-full"
      />
      <aside className="grid content-start gap-4 lg:min-h-0 lg:overflow-y-auto">
        <TileActions system={root} tree={tree} search={search} onSearchChange={onSearchChange} />
        <Breadcrumb system={tree} view={viewOf(search)} onViewChange={onViewChange} />
      </aside>
    </>
  )
}
