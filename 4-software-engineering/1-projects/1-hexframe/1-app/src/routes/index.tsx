// Home: the signed-in Account's System, on the canvas, with the centered Tile's actions and its
// ancestors beside it. The view and the change under way live in the search params, so a link shows
// what its sender saw. Signed out, the guard sends the visit to sign-in, then back here.
import { createFileRoute } from '@tanstack/react-router'

import { ReadBoundary } from '#/api/client/ReadBoundary'
import { signedIn } from '#/api/domains/iam/guard'
import { useSystem } from '#/api/domains/mapping/queries'
import { Breadcrumb } from '#/features/breadcrumb/Breadcrumb'
import { readSystemSearch, viewOf, withView, type SystemSearch } from '#/features/system/search'
import { System } from '#/features/system/System'
import { TileActions } from '#/features/system/TileActions'
import { canvasTree } from '#/features/system/tree'
import { m } from '#/paraglide/messages'
import { Skeleton } from '#/ui/feedback/skeleton'

export const Route = createFileRoute('/')({
  beforeLoad: signedIn,
  validateSearch: readSystemSearch,
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const onSearchChange = (next: SystemSearch) => {
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
  onSearchChange: (search: SystemSearch) => void
}

function SystemPage({ search, onSearchChange }: SystemPageProps) {
  const { data: system } = useSystem()
  if (system === undefined) {
    return (
      <>
        <Skeleton className="h-[60dvh] lg:h-full" />
        <Skeleton className="h-40" />
      </>
    )
  }
  const tree = canvasTree(system)
  return (
    <>
      <System
        tree={tree}
        search={search}
        onSearchChange={onSearchChange}
        className="h-[80dvh] min-h-0 lg:h-full"
      />
      <aside className="grid content-start gap-4 lg:min-h-0 lg:overflow-y-auto">
        <TileActions system={system} tree={tree} search={search} onSearchChange={onSearchChange} />
        <Breadcrumb
          system={tree}
          view={viewOf(search)}
          onViewChange={(view) => {
            onSearchChange(withView(search, view))
          }}
        />
      </aside>
    </>
  )
}
