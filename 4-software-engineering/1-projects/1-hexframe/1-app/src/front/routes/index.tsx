// Home: the one screen, signed in. The Account's System on the canvas, the centered Tile's card at its
// foot, where you are in the canvas's corner, the theme at its head, and the chat, over the Account's
// Conversation, its composer at its foot: wide, side by side along the curve; on a phone, one side in
// front, the chat when the page opens, the seam turning it, and a Tile the chat names bringing the
// canvas forward. The view and the change under way live in the search params, so a link shows what its
// sender saw; a Tile's form opens as a drawer. Every gesture that changes the view is published on the
// client bus as a navigation fact, which the Conversation's navigation sender merges and records once
// something else enters the timeline, a Message the chat posts included, or the page is hidden. Signed
// out, the guard sends the visit to sign-in, then back here. The page follows the System and the
// Conversation, so a write it did not make, an agent's, a Key's or another tab's, shows on the canvas
// and in the timeline once the tab regains focus, and every 2 s while a Turn runs. A Message is sent
// from the view: its center, where the Turn answering it starts unless it opens with a link to a Tile,
// and the Tiles on screen; a refused one is posted again when the chat retries it. A Tile the chat
// names centers the canvas on it, a gesture as any other.
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'

import { ReadBoundary } from '#/front/client/ReadBoundary'
import { signedInOnly } from '#/front/client/iam/guard'
import { useFollowLatest } from '#/front/client/assistant/follow'
import { useSystem } from '#/front/client/mapping/queries'
import { Breadcrumb } from '#/front/features/breadcrumb/Breadcrumb'
import { publish } from '#/front/features/bus'
import { ChatComposer, ChatTimeline } from '#/front/features/conversation/Chat'
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
import { canvasTree, onScreen } from '#/front/features/system/tree'
import { m } from '#/paraglide/messages'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import { Screen } from '#/front/ui/layouts/screen/Screen'
import { useScreenState } from '#/front/ui/layouts/screen/state/useScreenState'
import { centerOn, type CanvasView, type ViewAction } from '#/front/ui/canvas/view/view'

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
  const { turn, mode } = useFollowLatest()
  // The chat's Messages go after the navigation they follow, from the view they were sent from.
  const { postMessage } = useNavigationSender()
  // On a phone, the side in front.
  const { state: screen, actions: turning } = useScreenState()
  // Outside every boundary, the System read without throwing for what the chat sends and the corner
  // shows: a failed read shows on the canvas, in its own boundary, and leaves the chat up, waiting to
  // send, and the theme at the corner's head.
  const { data } = useSystem({ throwing: false })
  const root = data?.root
  const tree = useMemo(() => (root === undefined ? undefined : canvasTree(root)), [root])
  const onSend =
    tree === undefined
      ? undefined
      : (text: string) => {
          postMessage({ text, view: onScreen(tree, viewOf(search)) })
        }
  const onViewChange = (view: CanvasView, action: ViewAction) => {
    onSearchChange(withView(search, view))
    publish(new Navigated(action))
  }
  // A Tile the chat names crosses to the canvas: centered on it, the canvas comes forward.
  const onCenter = (tile: string) => {
    if (tree === undefined) return
    onViewChange(centerOn(tree, tile), { gesture: 'center', tile })
    turning.cross()
  }
  return (
    <main className="h-[calc(100dvh-var(--header))]">
      <h1 className="sr-only">{m.system_title()}</h1>
      <Screen
        front={screen.front}
        onFrontChange={turning.turn}
        className="size-full"
        canvas={
          <ReadBoundary>
            <SystemPage
              search={search}
              onSearchChange={onSearchChange}
              onViewChange={onViewChange}
            />
          </ReadBoundary>
        }
        corner={<Breadcrumb system={tree} view={viewOf(search)} onViewChange={onViewChange} />}
        messages={
          <ReadBoundary>
            <ChatTimeline onCenter={onCenter} turn={turn} resend={postMessage} />
          </ReadBoundary>
        }
        composer={
          <ReadBoundary>
            <ChatComposer onSend={onSend} turn={turn} mode={mode} />
          </ReadBoundary>
        }
      />
    </main>
  )
}

interface SystemPageProps {
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  onViewChange: (view: CanvasView, action: ViewAction) => void
}

/** The canvas side: the System, and the centered Tile's card at its foot. */
function SystemPage({ search, onSearchChange, onViewChange }: SystemPageProps) {
  const { data } = useSystem()
  if (data === undefined) {
    return (
      <div className={side}>
        <Skeleton className="min-h-0 flex-1" />
        <Skeleton className="h-32" />
      </div>
    )
  }
  const { system, root } = data
  const tree = canvasTree(root)
  return (
    <div className={side}>
      <System
        system={system}
        tree={tree}
        search={search}
        onViewChange={onViewChange}
        onSearchChange={onSearchChange}
        className="min-h-0 flex-1"
      />
      <div className="max-h-[30%] flex-none overflow-y-auto">
        <TileActions system={root} tree={tree} search={search} onSearchChange={onSearchChange} />
      </div>
    </div>
  )
}

const side = 'flex min-w-0 flex-1 flex-col gap-3 p-4'
