// Home: the one screen, signed in or out. Signed in, the Account's System on the canvas, the centered
// Tile's card at its foot, where you are in the canvas's corner, the theme at its head, and the chat,
// over the Account's Conversation, its composer at its foot: wide, side by side along the curve; on a
// phone, one side in front, the chat when the page opens, the seam turning it, and a Tile the chat
// names bringing the canvas forward. The view and the change under way live in the search params, so
// a link shows what its sender saw; a Tile's form, its import and its export open in the chat, at the
// conversation's foot, as the tile widget, which a phone brings to the front, and so do the Keys
// (`keys`) and Help (`help`), Help taking the canvas while its widget is open. Every gesture that
// changes the view of the System is published on the client bus as a navigation fact, which the
// Conversation's navigation sender merges and records once something else enters the timeline, a
// Message the chat posts included, or the page is hidden. The page follows the System and the
// Conversation, so a write it did not make, an agent's, a Key's or another tab's, shows on the canvas
// and in the timeline once the tab regains focus, and every 2 s while a Turn runs. A Message is sent
// from the view: its center, where the Turn answering it starts unless it opens with a link to a Tile,
// and the Tiles on screen; a refused one is posted again when the chat retries it. A Tile the chat
// names centers the canvas on it, a gesture as any other. Signed out, the same screen: Help on the
// canvas, two lines from the agent, and the sign-in widget in the composer's place, which signs in or
// up, then comes back where the user was.
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMemo } from 'react'

import { ReadBoundary } from '#/front/client/ReadBoundary'
import { readSignInSearch, sessionIfAny } from '#/front/client/iam/guard'
import { useFollowLatest } from '#/front/client/assistant/follow'
import { useHelp, useSystem } from '#/front/client/mapping/queries'
import { accessOf, readAccessSearch, wayBack, withAccess } from '#/front/features/access/search'
import { SignedOutLines, SignInFoot } from '#/front/features/access/SignedOut'
import { Breadcrumb } from '#/front/features/breadcrumb/Breadcrumb'
import { publish } from '#/front/features/bus'
import { ChatComposer, ChatTimeline } from '#/front/features/conversation/Chat'
import { useNavigationSender } from '#/front/features/conversation/state/useNavigationSender'
import { Navigated } from '#/front/features/facts'
import { HelpCanvas, HelpTile } from '#/front/features/help/Help'
import { HelpWidgets } from '#/front/features/help/HelpWidgets'
import { readHelpSearch, turnedTo, withHelp } from '#/front/features/help/search'
import { KeyWidgets } from '#/front/features/keys/KeyWidgets'
import { readKeysSearch, withKeys } from '#/front/features/keys/search'
import { useKeyWidgetState } from '#/front/features/keys/state/useKeyWidgetState'
import {
  opensWidget,
  readSystemSearch,
  viewOf,
  withView,
  type SearchChange,
  type SystemSearch,
} from '#/front/features/system/search/search'
import { System } from '#/front/features/system/System'
import { TileActions } from '#/front/features/system/TileActions'
import { canvasTree, onScreen } from '#/front/features/system/tree'
import { TileWidgets } from '#/front/features/system/widget/TileWidgets'
import {
  type TileWidgetsState,
  useTileWidgetsState,
} from '#/front/features/system/widget/state/useTileWidgetsState'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import { Screen } from '#/front/ui/layouts/screen/Screen'
import { useScreenState } from '#/front/ui/layouts/screen/state/useScreenState'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import { centerOn, withViewIn, type CanvasView, type ViewAction } from '#/front/ui/canvas/view/view'

/**
 * Home's search params, each feature's read on its own: the System's view and change, the Keys and
 * Help open in the chat, and, signed out, signing up and where to go once signed in.
 */
const readHomeSearch = (search: Record<string, unknown>) => ({
  ...readSystemSearch(search),
  ...readKeysSearch(search),
  ...readHelpSearch(search),
  ...readAccessSearch(search),
  ...readSignInSearch(search),
})

type HomeSearch = ReturnType<typeof readHomeSearch>

export const Route = createFileRoute('/')({
  beforeLoad: sessionIfAny,
  validateSearch: readHomeSearch,
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  return session === undefined ? <SignedOut /> : <SignedIn />
}

/**
 * What signed-in home holds beside the System's own search params, the widgets open, which a change of
 * the System keeps. `access` and `redirect` mean something signed out alone, so they go.
 */
const screenOf = ({ keys, help }: HomeSearch) => ({ keys, help })

/** Help, read in the page's language as the canvas draws it, beside the canvas: never throwing. */
function useHelpTree() {
  const { data } = useHelp(getLocale(), { throwing: false })
  return useMemo(() => (data === undefined ? undefined : canvasTree(data)), [data])
}

/**
 * Help's navigation on home: its canvas's view, its widget's topic, and Read on its card. A topic
 * centered on the canvas brings it forward on a phone; one opened from the card brings the chat.
 */
function useHelpNavigation(turning: ReturnType<typeof useScreenState>['actions']) {
  const navigate = Route.useNavigate()
  const tree = useHelpTree()
  const go = (next: (current: HomeSearch) => HomeSearch) => {
    void navigate({ search: next })
  }
  return {
    tree,
    onViewChange: (view: CanvasView) => {
      go((current) => withViewIn(current, view))
    },
    onTopic: (id: string, center: boolean) => {
      const view = center && tree !== undefined ? centerOn(tree, id) : undefined
      go((current) => turnedTo(current, id, view))
      if (center) turning.cross()
    },
    onRead: (id: string) => {
      go((current) => turnedTo(current, id))
      turning.turn('chat')
    },
  }
}

/** Signed out: Help on the canvas, the agent's two lines and Help's widget, and signing in. */
function SignedOut() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const { state: screen, actions: turning } = useScreenState()
  const help = useHelpNavigation(turning)
  const view = viewOf(search)
  return (
    <main className="h-[calc(100dvh-var(--header))]">
      <h1 className="sr-only">{m.help_title()}</h1>
      <Screen
        front={screen.front}
        onFrontChange={turning.turn}
        className="size-full"
        canvas={
          <ReadBoundary>
            <HelpSide view={view} onViewChange={help.onViewChange} onRead={help.onRead} />
          </ReadBoundary>
        }
        corner={<Breadcrumb system={help.tree} view={view} onViewChange={help.onViewChange} />}
        messages={
          <div className="grid gap-5">
            <SignedOutLines />
            {search.help !== undefined && (
              <ReadBoundary>
                <HelpWidgets
                  topic={search.help}
                  onTopic={help.onTopic}
                  onDismiss={() => {
                    void navigate({ search: (current) => ({ ...current, ...withHelp(undefined) }) })
                  }}
                />
              </ReadBoundary>
            )}
          </div>
        }
        composer={
          <SignInFoot
            access={accessOf(search)}
            onAccessChange={(access) => {
              void navigate({
                search: (current) => ({ ...current, ...withAccess(access) }),
                replace: true,
              })
            }}
            // Without a place to go back to, the screen as it stands, signed in.
            redirect={wayBack(search.redirect, screenOf(search), router.options.stringifySearch)}
          />
        }
      />
    </main>
  )
}

/** Signed in: the Account's System and its Conversation, the Keys and Help in the chat. */
function SignedIn() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // On a phone, the side in front.
  const { state: screen, actions: turning } = useScreenState()
  // What follows a tile's widget in the chat, and the export the card starts.
  const widgets = useTileWidgetsState()
  // The key widget's step: the receipt outlives the widget.
  const keys = useKeyWidgetState(search.keys === true)
  const help = useHelpNavigation(turning)
  const onSearchChange = (next: SearchChange) => {
    // A form, an import or an edit, opening: the tile widget comes, in front on a phone.
    if (opensWidget(search, next)) {
      widgets.actions.clear()
      turning.turn('chat')
    }
    void navigate({
      search: (current) => ({
        ...(typeof next === 'function' ? next(current) : next),
        ...screenOf(current),
      }),
    })
  }
  const { turn, mode } = useFollowLatest()
  // The chat's Messages go after the navigation they follow, from the view they were sent from.
  const { postMessage } = useNavigationSender()
  // Outside every boundary, the System read without throwing for what the chat sends and the corner
  // shows: a failed read shows on the canvas, in its own boundary, and leaves the chat up, waiting to
  // send, and the theme at the corner's head.
  const { data } = useSystem({ throwing: false })
  const root = data?.root
  const tree = useMemo(
    () => (root === undefined ? undefined : canvasTree(root, { yours: true })),
    [root],
  )
  const onViewChange = (view: CanvasView, action: ViewAction) => {
    onSearchChange(withView(search, view))
    publish(new Navigated(action))
  }
  // A Tile the chat names crosses to the canvas: centered on it, the canvas comes forward, the
  // System's again should Help have had it.
  const onCenter = (tile: string) => {
    if (tree === undefined) return
    const view = centerOn(tree, tile)
    void navigate({ search: (current) => ({ ...withView(current, view), ...withHelp(undefined) }) })
    publish(new Navigated({ gesture: 'center', tile }))
    turning.cross()
  }
  // What the canvas shows: Help while its widget is open, else the System. The URL's view is the
  // canvas's, so while Help has it the System's view is its Root, which a Message is sent from.
  const view = viewOf(search)
  const side =
    search.help === undefined
      ? {
          systemView: view,
          canvas: (
            <SystemPage
              search={search}
              onSearchChange={onSearchChange}
              onViewChange={onViewChange}
              widgets={widgets}
              onExport={() => {
                turning.turn('chat')
              }}
            />
          ),
          corner: <Breadcrumb system={tree} view={view} onViewChange={onViewChange} />,
        }
      : {
          systemView: {},
          canvas: <HelpSide view={view} onViewChange={help.onViewChange} onRead={help.onRead} />,
          corner: <Breadcrumb system={help.tree} view={view} onViewChange={help.onViewChange} />,
        }
  const onSend =
    tree === undefined
      ? undefined
      : (text: string) => {
          postMessage({ text, view: onScreen(tree, side.systemView) })
        }
  return (
    <main className="h-[calc(100dvh-var(--header))]">
      <h1 className="sr-only">{m.system_title()}</h1>
      <Screen
        front={screen.front}
        onFrontChange={turning.turn}
        className="size-full"
        canvas={<ReadBoundary>{side.canvas}</ReadBoundary>}
        corner={side.corner}
        messages={
          <div className="grid gap-5">
            <ReadBoundary>
              <ChatTimeline onCenter={onCenter} turn={turn} resend={postMessage} />
            </ReadBoundary>
            <ReadBoundary>
              <TileWidgets
                search={search}
                onSearchChange={onSearchChange}
                onCenter={onCenter}
                widgets={widgets}
                onFormBack={() => {
                  turning.turn('chat')
                }}
              />
            </ReadBoundary>
            {(search.keys !== undefined || keys.state.step.kind === 'done') && (
              <ReadBoundary>
                <KeyWidgets
                  open={search.keys !== undefined}
                  onClose={() => {
                    void navigate({ search: (current) => ({ ...current, ...withKeys(false) }) })
                  }}
                  keys={keys}
                />
              </ReadBoundary>
            )}
            {search.help !== undefined && (
              <ReadBoundary>
                <HelpWidgets
                  topic={search.help}
                  onTopic={help.onTopic}
                  // Help gives the canvas back to the System, at its Root.
                  onDismiss={() => {
                    void navigate({
                      search: (current) => ({ ...screenOf(current), ...withHelp(undefined) }),
                    })
                  }}
                />
              </ReadBoundary>
            )}
          </div>
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

interface HelpSideProps {
  view: CanvasView
  onViewChange: (view: CanvasView) => void
  /** Read on the card: the centered Tile's page in the help widget. */
  onRead: (id: string) => void
}

/** The canvas side, Help's: Help on the canvas, read-only, and the centered Tile's card at its foot. */
function HelpSide({ view, onViewChange, onRead }: HelpSideProps) {
  // The page's language, from its URL: Help's ids are the same in every language, so the view holds.
  const { data: help } = useHelp(getLocale())
  const tree = useMemo(() => (help === undefined ? undefined : canvasTree(help)), [help])
  if (tree === undefined) return <Loading />
  return (
    <div className={side}>
      <HelpCanvas tree={tree} view={view} onViewChange={onViewChange} className="min-h-0 flex-1" />
      <div className="max-h-[30%] flex-none overflow-y-auto">
        <HelpTile tree={tree} view={view} onRead={onRead} />
      </div>
    </div>
  )
}

interface SystemPageProps {
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  onViewChange: (view: CanvasView, action: ViewAction) => void
  widgets: TileWidgetsState
  /** An export started from the card: the chat, which shows it, comes to the front on a phone. */
  onExport: () => void
}

/** The canvas side, the System's: the System, and the centered Tile's card at its foot. */
function SystemPage({ search, onSearchChange, onViewChange, widgets, onExport }: SystemPageProps) {
  const { data } = useSystem()
  if (data === undefined) return <Loading />
  const { system, root, underway } = data
  const tree: TileNode = canvasTree(root, { yours: true })
  return (
    <div className={side}>
      <System
        system={system}
        tree={tree}
        underway={underway}
        search={search}
        onViewChange={onViewChange}
        onSearchChange={onSearchChange}
        className="min-h-0 flex-1"
      />
      <div className="max-h-[30%] flex-none overflow-y-auto">
        <TileActions
          system={root}
          flat={system}
          tree={tree}
          search={search}
          onSearchChange={onSearchChange}
          exporting={{
            start: (exported) => {
              widgets.actions.export(exported)
              onExport()
            },
            pending: widgets.state.exporting,
          }}
        />
      </div>
    </div>
  )
}

/** A side while its read is on its way: the canvas and its card. */
function Loading() {
  return (
    <div className={side}>
      <Skeleton className="min-h-0 flex-1" />
      <Skeleton className="h-32" />
    </div>
  )
}

const side = 'flex min-w-0 flex-1 flex-col gap-3 p-4'
