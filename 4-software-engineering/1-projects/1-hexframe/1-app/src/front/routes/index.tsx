// Home: the signed-in Account's System, on the canvas, the centered Tile's ancestors above it and its
// card below, and the chat beside it, over the Account's Conversation. The view and the change under
// way live in the search params, so a link shows what its sender saw; a Tile's form opens as a drawer.
// Every gesture that changes the view is published on the client bus as a navigation fact, which the
// Conversation's navigation sender merges and records once something else enters the timeline, a
// Message the chat posts included, or the page is hidden. Signed out, the guard sends the visit to
// sign-in, then back here. The page follows the System and the Conversation, so a write it did not
// make, an agent's, a Key's or another tab's, shows on the canvas and in the timeline once the tab
// regains focus.
import { createFileRoute } from '@tanstack/react-router'

import { ReadBoundary } from '#/front/client/ReadBoundary'
import { signedInOnly } from '#/front/client/iam/guard'
import { useFollowLatest } from '#/front/client/assistant/follow'
import { useSystem } from '#/front/client/mapping/queries'
import { Breadcrumb } from '#/front/features/breadcrumb/Breadcrumb'
import { publish } from '#/front/features/bus'
import { Chat } from '#/front/features/conversation/Chat'
import { useNavigationSender } from '#/front/features/conversation/state/useNavigationSender'
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
  // Nothing follows them closely yet: a Turn will, while it runs.
  useFollowLatest({ closely: false })
  // The chat's Messages go after the navigation they follow.
  const { postMessage } = useNavigationSender()
  return (
    <main className="grid gap-4 px-4 pb-4 lg:h-[calc(100dvh-4.25rem)] lg:grid-cols-[minmax(0,1fr)_24rem]">
      <h1 className="sr-only">{m.system_title()}</h1>
      <div className="grid min-h-0 content-start gap-3 lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:content-stretch">
        <ReadBoundary>
          <SystemPage search={search} onSearchChange={onSearchChange} />
        </ReadBoundary>
      </div>
      <ReadBoundary>
        <Chat onSend={postMessage} className="h-[32rem] lg:h-auto lg:min-h-0" />
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
  if (data === undefined) {
    return (
      <>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-[60dvh] lg:h-full" />
        <Skeleton className="h-32" />
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
      <Breadcrumb system={tree} view={viewOf(search)} onViewChange={onViewChange} />
      <System
        system={system}
        tree={tree}
        search={search}
        onViewChange={onViewChange}
        onSearchChange={onSearchChange}
        className="h-[70dvh] min-h-0 lg:h-full"
      />
      <div className="lg:max-h-[30dvh] lg:overflow-y-auto">
        <TileActions system={root} tree={tree} search={search} onSearchChange={onSearchChange} />
      </div>
    </>
  )
}
