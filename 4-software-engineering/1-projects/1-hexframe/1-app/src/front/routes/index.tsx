// Home: the one screen, signed in or out, filling the window. Signed in, the Account's System on the
// canvas, its center alone and large until a click opens it, a Tile centered landing opened, where
// you are in the canvas's corner, the Sunstone at its head, and the chat, over the Account's
// Conversation, its composer at its foot, whose `/help` and `/keys` open Help and the Keys: wide,
// side by side along the curve; on a
// phone, one side in front, the chat when the page opens, the seam turning it, and a Tile the chat
// names bringing the canvas forward. The view and the change under way live in the search params, so
// a link shows what its sender saw; a Tile's form, its import and its export open in the chat, at the
// conversation's foot, as the tile widget, which a phone brings to the front, and so do the Keys
// (`keys`) and Help (`help`), Help taking the canvas while its widget is open; the tutorial takes it,
// read-only as Help, while the URL names it (`tutorial`), and gives it back to the System when it
// goes. Every gesture that changes the view of the System is published on the client bus as a
// navigation fact, which the
// Conversation's navigation sender merges and records once something else enters the timeline, a
// Message the chat posts included, or the page is hidden. The page follows the System and the
// Conversation, so a write it did not make, an agent's, a Key's or another tab's, shows on the canvas
// and in the timeline once the tab regains focus, and every 2 s while a Turn runs. A Message is sent
// from the view: its center, where the Turn answering it starts unless it opens with a link to a Tile,
// and the Tiles on screen; a refused one is posted again when the chat retries it. A Tile the chat
// names centers the canvas on it, a gesture as any other. The chat says under its field where the next
// Turn works; a Tile's menu asks the agent through it, naming the Tile first; and a Tile dragged off
// the canvas under a mouse or a pen is carried over the page, the composer naming it where it is let
// go (HEX-110). A new account is asked its pseudo first, the composer and the corner's path held back
// until it names the Root; then, while its Root holds nothing and nothing was said, the agent's one
// line after the receipt invites its first command, `/tutorial`, which the tutorial's param
// answers, and which the composer offers first (HEX-118). Signed out, the same screen: Help on the
// canvas, two lines from the agent and its offer to read the centered topic in full, and the
// sign-in widget in the composer's place, which signs in or up, then comes back where the user was.
// While the help widget is open, a topic centered on Help's canvas turns its page.
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { ReadBoundary } from '#/front/client/ReadBoundary'
import { readSignInSearch, sessionIfAny } from '#/front/client/iam/guard'
import { useFollowLatest } from '#/front/client/assistant/follow'
import { useShipped, useSystem } from '#/front/client/mapping/queries'
import { accessOf, readAccessSearch, wayBack, withAccess } from '#/front/features/access/search'
import { SignedOutLines, SignInFoot } from '#/front/features/access/SignedOut'
import { Breadcrumb } from '#/front/features/breadcrumb/Breadcrumb'
import { publish } from '#/front/features/bus'
import { ChatComposer, ChatInvitation, ChatTimeline } from '#/front/features/conversation/Chat'
import { useNavigationSender } from '#/front/features/conversation/state/useNavigationSender'
import { AskedAboutTile, Navigated } from '#/front/features/facts'
import { HelpWidgets } from '#/front/features/shipped/HelpWidgets'
import { helpNodeOf, topicFound } from '#/front/features/shipped/nodes'
import {
  readHelpSearch,
  readTutorialSearch,
  shippedOnCanvas,
  turnedTo,
  tutorialOn,
  withHelp,
  withTutorial,
} from '#/front/features/shipped/search'
import { HelpRead, ShippedCanvas } from '#/front/features/shipped/Shipped'
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
import { useMarksState } from '#/front/features/system/marks/useMarksState'
import { System } from '#/front/features/system/System'
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
import type { CanvasMarks } from '#/front/ui/canvas/Canvas'
import type { CarriedTile } from '#/front/ui/canvas/state/move/carry'
import { findTile, type TileNode } from '#/front/ui/canvas/view/tiles'
import { centerOn, withViewIn, type CanvasView, type ViewAction } from '#/front/ui/canvas/view/view'
import type { Direction, ShippedRoot } from '#/domains/mapping/entities'

/**
 * Home's search params, each feature's read on its own: the System's view and change, the Keys and
 * Help open in the chat, the tutorial on the canvas, and, signed out, signing up and where to go once
 * signed in.
 */
const readHomeSearch = (search: Record<string, unknown>) => ({
  ...readSystemSearch(search),
  ...readKeysSearch(search),
  ...readHelpSearch(search),
  ...readTutorialSearch(search),
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

/**
 * Help, read in the page's language beside the canvas, never throwing: as the canvas draws it, and as
 * the help widget reads its topics.
 */
function useHelpTree() {
  const { data } = useShipped('help', getLocale(), { throwing: false })
  return useMemo(
    () => (data === undefined ? undefined : { tree: canvasTree(data), topics: helpNodeOf(data) }),
    [data],
  )
}

/**
 * Help's navigation on home: its canvas's view, its widget's topic, the agent's offer to read a topic
 * in full, and `/help`. A topic centered on the canvas brings it forward on a phone, and turns the
 * widget's page while it is open; one opened to read, or by `/help`, brings the chat.
 */
function useHelpNavigation(turning: ReturnType<typeof useScreenState>['actions']) {
  const navigate = Route.useNavigate()
  const help = useHelpTree()
  const tree = help?.tree
  const go = (next: (current: HomeSearch) => HomeSearch) => {
    void navigate({ search: next })
  }
  return {
    tree,
    onViewChange: (view: CanvasView) => {
      go((current) =>
        // The page follows the topic centered, the widget open; the Root's is Help's own.
        current.help === undefined || view.center === current.center
          ? withViewIn(current, view)
          : { ...withViewIn(current, view), ...withHelp(view.center ?? true) },
      )
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
    /**
     * `/help`: Help on the canvas and in the chat, on the topic the words find, centered, or on its
     * Root; the System's view and change set aside, as Help takes the canvas.
     */
    onOpen: (words: string) => {
      const topic = help === undefined ? undefined : topicFound(help.topics, words)
      const view = topic === undefined || tree === undefined ? {} : centerOn(tree, topic)
      go((current) => ({ ...screenOf(current), ...view, ...withHelp(topic ?? true) }))
      turning.turn('chat')
    },
  }
}

/**
 * The tutorial's navigation on home, read-only: its Tiles, for the corner, read beside the canvas
 * without throwing, and only while it is `open` on the canvas, and its canvas's view, whose center
 * its param holds.
 */
function useTutorialNavigation(open: boolean) {
  const navigate = Route.useNavigate()
  const { data } = useShipped('tutorial', getLocale(), { throwing: false, enabled: open })
  const tree = useMemo(() => (data === undefined ? undefined : canvasTree(data)), [data])
  return {
    tree,
    onViewChange: (view: CanvasView) => {
      void navigate({ search: (current) => tutorialOn(current, view) })
    },
  }
}

/** How home moves around a System hexframe ships: its Tiles, for the corner, and its view. */
interface ShippedNavigation {
  tree: TileNode | undefined
  onViewChange: (view: CanvasView) => void
}

/**
 * The canvas and its corner while a System hexframe ships has them, read-only; none, the Account's
 * System's then. The URL's view is the canvas's, so meanwhile the System's view is its Root, which a
 * Message is sent from.
 */
function shippedSide(search: HomeSearch, navigation: Record<ShippedRoot, ShippedNavigation>) {
  const shown = shippedOnCanvas(search)
  if (shown === undefined) return undefined
  const { shipped, view } = shown
  const { tree, onViewChange } = navigation[shipped]
  const systemView: CanvasView = {}
  return {
    systemView,
    canvas: <ShippedSide key={shipped} shipped={shipped} view={view} onViewChange={onViewChange} />,
    corner: <Breadcrumb system={tree} view={view} onViewChange={onViewChange} />,
  }
}

/**
 * The Account's System, read outside every boundary without throwing, for what the chat sends and the
 * corner shows: a failed read shows on the canvas, in its own boundary, and leaves the chat up,
 * waiting to send, and the mark alone at the corner's head; and its Tiles as the canvas draws them,
 * yours. A new account is asked its pseudo before anything else (`welcoming`): the chat holds back its
 * composer and the corner its path (`path`), the mark alone, until the pseudo names the Root; then
 * they come one after another, from the corner down to the composer, as the dawn's tokens time them.
 * `/design-system`'s Onboarding slide plays it again on the same pieces
 * (`ui/gallery/deck/tour.tsx`): what changes here changes there too.
 */
function useYourSystem() {
  const { data } = useSystem({ throwing: false })
  const root = data?.root
  const tree = useMemo(
    () => (root === undefined ? undefined : canvasTree(root, { yours: true })),
    [root],
  )
  const welcoming = root?.title === ''
  return { system: data?.system, tree, welcoming, path: welcoming ? undefined : tree }
}

/** `/keys`: the key widget opened at the conversation's foot, which a phone brings to the front. */
function useOpenKeys(turning: ReturnType<typeof useScreenState>['actions']) {
  const navigate = Route.useNavigate()
  return () => {
    void navigate({ search: (current) => ({ ...current, ...withKeys(true) }) })
    turning.turn('chat')
  }
}

/**
 * `/tutorial`, typed or clicked in the agent's invitation: the tutorial on the canvas, at its Root,
 * read-only, Help's widget closed and the System's view and change set aside, as the tutorial takes
 * the canvas, which a phone brings to the front. The journey there is HEX-119's.
 */
function useOpenTutorial(turning: ReturnType<typeof useScreenState>['actions']) {
  const navigate = Route.useNavigate()
  return () => {
    void navigate({
      search: (current) => ({
        ...screenOf(current),
        ...withHelp(undefined),
        ...withTutorial(true),
      }),
    })
    turning.turn('canvas')
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
    <main className="h-dvh">
      <h1 className="sr-only">{m.help_title()}</h1>
      <Screen
        front={screen.front}
        onFrontChange={turning.turn}
        className="size-full"
        canvas={
          <ReadBoundary>
            <ShippedSide shipped="help" view={view} onViewChange={help.onViewChange} />
          </ReadBoundary>
        }
        corner={<Breadcrumb system={help.tree} view={view} onViewChange={help.onViewChange} />}
        messages={
          <div className="grid gap-5">
            <SignedOutLines />
            {search.help === undefined && help.tree !== undefined && (
              <HelpRead tree={help.tree} view={view} onRead={help.onRead} />
            )}
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

/**
 * Signed in: the Account's System and its Conversation, the Keys and Help in the chat, Help or the
 * tutorial taking the canvas while the URL names it.
 */
function SignedIn() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // On a phone, the side in front.
  const { state: screen, actions: turning } = useScreenState()
  // What follows a tile's widget in the chat, and the export a Tile's menu starts.
  const widgets = useTileWidgetsState()
  // The key widget's step: the receipt outlives the widget.
  const keys = useKeyWidgetState(search.keys === true)
  const help = useHelpNavigation(turning)
  const tutorial = useTutorialNavigation(search.tutorial !== undefined)
  const openKeys = useOpenKeys(turning)
  const openTutorial = useOpenTutorial(turning)
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
  const { postMessage, underWay } = useNavigationSender()
  const { system, tree, welcoming, path } = useYourSystem()
  // What crosses from the chat to the canvas: the Tile it points at, the one it centered, where the
  // running Turn works, the changes made meanwhile, and the open Proposal.
  const marks = useMarksState({ system, working: turn?.location })
  // What crosses from the canvas to the chat: a Tile carried off it, for the composer to name.
  const [carried, setCarried] = useState<CarriedTile>()
  const onViewChange = (view: CanvasView, action: ViewAction) => {
    onSearchChange(withView(search, view))
    publish(new Navigated(action))
    marks.actions.went(action)
  }
  // A Tile the chat names crosses to the canvas: centered on it, glinting as it arrives, the canvas
  // comes forward, saying what it shows, the System's again should Help or the tutorial have had it.
  const onCenter = (tile: string) => {
    if (tree === undefined) return
    const view = centerOn(tree, tile)
    const away = { ...withHelp(undefined), ...withTutorial(undefined) }
    void navigate({ search: (current) => ({ ...withView(current, view), ...away }) })
    publish(new Navigated({ gesture: 'center', tile }))
    marks.actions.arrive(tile)
    // The canvas's tree names an untitled Root already.
    const title = findTile(tree, tile)?.title
    turning.cross(title === undefined ? undefined : m.crossing_phone_said({ title }))
  }
  // What the canvas shows: a System hexframe ships while the URL names it, else the Account's.
  const view = viewOf(search)
  const side = shippedSide(search, { help, tutorial }) ?? {
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
        marks={marks.marks}
        onCarry={setCarried}
      />
    ),
    corner: <Breadcrumb system={path} view={view} onViewChange={onViewChange} />,
  }
  const onSend =
    tree === undefined
      ? undefined
      : (text: string) => {
          postMessage({ text, view: onScreen(tree, side.systemView) })
        }
  return (
    <main className="h-dvh">
      <h1 className="sr-only">{m.system_title()}</h1>
      <Screen
        front={screen.front}
        onFrontChange={turning.turn}
        said={screen.said}
        className="size-full"
        canvas={<ReadBoundary>{side.canvas}</ReadBoundary>}
        corner={side.corner}
        composerAway={welcoming}
        messages={
          <div className="grid gap-5">
            <ReadBoundary>
              <ChatTimeline
                onCenter={onCenter}
                pointing={{ card: marks.cardOf, onPoint: marks.actions.point }}
                turn={turn}
                resend={postMessage}
                underWay={underWay}
                // What the tile widget's receipt says below, the timeline leaves to it.
                receipt={widgets.state.told}
              />
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
            <ChatInvitation onTutorial={openTutorial} dawning={widgets.state.dawning} />
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
            <HelpFoot topic={search.help} onTopic={help.onTopic} />
          </div>
        }
        composer={
          <ReadBoundary>
            <ChatComposer
              onSend={onSend}
              turn={turn}
              mode={mode}
              onPoint={marks.actions.pointRow}
              center={tree === undefined ? undefined : onScreen(tree, side.systemView).center}
              carried={carried}
              onHelp={help.onOpen}
              onKeys={openKeys}
              onTutorial={openTutorial}
            />
          </ReadBoundary>
        }
      />
    </main>
  )
}

interface HelpFootProps {
  /** The topic the help widget is open on; closed when absent. */
  topic: string | true | undefined
  onTopic: (id: string, center: boolean) => void
}

/**
 * The help widget at the conversation's foot while it is open, signed in. Dismissed, Help gives the
 * canvas back to the System, at its Root.
 */
function HelpFoot({ topic, onTopic }: HelpFootProps) {
  const navigate = Route.useNavigate()
  if (topic === undefined) return null
  return (
    <ReadBoundary>
      <HelpWidgets
        topic={topic}
        onTopic={onTopic}
        onDismiss={() => {
          void navigate({ search: (current) => ({ ...screenOf(current), ...withHelp(undefined) }) })
        }}
      />
    </ReadBoundary>
  )
}

interface ShippedSideProps {
  shipped: ShippedRoot
  view: CanvasView
  onViewChange: (view: CanvasView) => void
}

/** The canvas side of a System hexframe ships, Help's or the tutorial's: on the canvas, read-only. */
function ShippedSide({ shipped, view, onViewChange }: ShippedSideProps) {
  // The page's language, from its URL: a shipped System's ids are the same in every language, so the
  // view holds.
  const { data } = useShipped(shipped, getLocale())
  const tree = useMemo(() => (data === undefined ? undefined : canvasTree(data)), [data])
  if (tree === undefined) return <Loading />
  return (
    <div className={side}>
      <ShippedCanvas
        tree={tree}
        view={view}
        onViewChange={onViewChange}
        className="min-h-0 flex-1"
      />
    </div>
  )
}

interface SystemPageProps {
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  onViewChange: (view: CanvasView, action: ViewAction) => void
  widgets: TileWidgetsState
  /** An export started from a Tile's menu: the chat, which shows it, comes to the front on a phone. */
  onExport: () => void
  /** Who touches what the canvas draws, the chat's crossings among them. */
  marks: CanvasMarks
  /** A Tile carried off the canvas, for the composer to name; none once let go. */
  onCarry: (tile: CarriedTile | undefined) => void
}

/** A Tile's menu asking the agent: the chat's composer names the Tile first. */
const ask = (tile: string, place?: Direction) => {
  publish(new AskedAboutTile({ tile, ...(place !== undefined && { place }) }))
}

/** The canvas side, the System's. */
function SystemPage(props: SystemPageProps) {
  const { search, onSearchChange, onViewChange, widgets, onExport, marks, onCarry } = props
  const { data } = useSystem()
  if (data === undefined) return <Loading />
  const { system, root, underway } = data
  // The pseudo a new account is typing shows on its Root as it is typed.
  const tree: TileNode = canvasTree(root, { yours: true, naming: widgets.state.naming })
  return (
    <div className={side}>
      <System
        system={system}
        root={root}
        tree={tree}
        underway={underway}
        search={search}
        onViewChange={onViewChange}
        onSearchChange={onSearchChange}
        exporting={{
          start: (exported) => {
            widgets.actions.export(exported)
            onExport()
          },
          pending: widgets.state.exporting,
        }}
        marks={marks}
        onAsk={ask}
        onCarry={onCarry}
        className="min-h-0 flex-1"
      />
    </div>
  )
}

/** A side while its read is on its way. */
function Loading() {
  return (
    <div className={side}>
      <Skeleton className="min-h-0 flex-1" />
    </div>
  )
}

const side = 'flex min-w-0 flex-1 flex-col gap-3 p-4'
