// Help: the System hexframe ships, on the canvas, read-only, in the page's language, with the centered
// Tile's card and its ancestors beside it. The view and the open Body live in the search params, so a
// link shows what its sender saw. Anyone reads it: no guard, no sign-in.
import { createFileRoute } from '@tanstack/react-router'

import { ReadBoundary } from '#/front/client/ReadBoundary'
import { useHelp } from '#/front/client/mapping/queries'
import { Breadcrumb } from '#/front/features/breadcrumb/Breadcrumb'
import { HelpCanvas, HelpTile } from '#/front/features/help/Help'
import { readHelpSearch, viewOf, withView, type HelpSearch } from '#/front/features/help/search'
import { canvasTree, tileIn } from '#/front/features/system/tree'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { Skeleton } from '#/front/ui/feedback/skeleton'

export const Route = createFileRoute('/help')({
  validateSearch: readHelpSearch,
  component: HelpRoute,
})

function HelpRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const onSearchChange = (next: HelpSearch) => {
    void navigate({ search: next })
  }
  return (
    <main className="grid gap-4 px-4 pb-4 lg:h-[calc(100dvh-4.25rem)] lg:grid-cols-[minmax(0,1fr)_18rem]">
      <h1 className="sr-only">{m.help_title()}</h1>
      <ReadBoundary>
        <HelpPage search={search} onSearchChange={onSearchChange} />
      </ReadBoundary>
    </main>
  )
}

interface HelpPageProps {
  search: HelpSearch
  onSearchChange: (search: HelpSearch) => void
}

function HelpPage({ search, onSearchChange }: HelpPageProps) {
  // The page's language, from its URL: Help's ids are the same in every language, so the view holds.
  const { data: help } = useHelp(getLocale())
  if (help === undefined) {
    return (
      <>
        <Skeleton className="h-[60dvh] lg:h-full" />
        <Skeleton className="h-40" />
      </>
    )
  }
  const tree = canvasTree(help)
  const opened = search.open === undefined ? undefined : tileIn(help, search.open)?.tile
  return (
    <>
      <HelpCanvas
        tree={tree}
        search={search}
        onSearchChange={onSearchChange}
        className="h-[80dvh] min-h-0 w-full lg:h-full"
      />
      <aside className="grid content-start gap-4 lg:min-h-0 lg:overflow-y-auto">
        <HelpTile tree={tree} search={search} onSearchChange={onSearchChange} opened={opened} />
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
