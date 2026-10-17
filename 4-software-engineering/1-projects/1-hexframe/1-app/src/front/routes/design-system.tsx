// The design system, for anyone, in production too, as a deck of slides (`ui/gallery/deck/`): why
// hexframe exists and the principles its look follows, in words on the ground alone; then the screen
// as it builds up, the chat, then the canvas, its first tile alone and large, then the onboarding,
// a new account's first visit, played again at will; then where the two sides answer each other,
// each crossing played on the whole screen; then each side's pieces and those they share, one at a
// time, on the canvas, told in the chat; then the tokens. The slide, its piece and the canvas's
// view live in the search params, so a link shows what its sender saw, and a Message's link in the
// Conversation centers the canvas, as on home. What ui/ can't reach the route hands it: the
// features' specimens, the Conversation, the breadcrumb and Help, Mapping's limit on a Preview,
// IAM's rule for a Key's name, the timeline's words for a navigation, Assistant's rule for where a
// Turn works (HEX-108), and the tutorial, which the onboarding's invitation journeys to (HEX-119).
// The Screen's specimens are drawn here, since they show the breadcrumb and Help.
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { merged, turnLocation, type Navigation } from '#/domains/assistant/entities'
import { keyNameBounds, keyNameOf } from '#/domains/iam/entities'
import { previewLimit } from '#/domains/mapping/entities'
import { ChannelsGallery } from '#/front/client/gallery'
import { ReadBoundary } from '#/front/client/ReadBoundary'
import { useShipped } from '#/front/client/mapping/queries'
import { Breadcrumb } from '#/front/features/breadcrumb/Breadcrumb'
import { BreadcrumbGallery } from '#/front/features/breadcrumb/gallery'
import { encoded } from '#/front/features/conversation/composer/mention'
import { happenedOf } from '#/front/features/conversation/entry/words'
import { ConversationGallery } from '#/front/features/conversation/gallery'
import { helpNodeOf } from '#/front/features/shipped/nodes'
import { canvasTree } from '#/front/features/system/tree'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import { AtomsGallery } from '#/front/ui/atoms/gallery'
import { Canvas } from '#/front/ui/canvas/Canvas'
import { fixtureViews, ulysse } from '#/front/ui/canvas/fixtures'
import { CanvasLayoutsGallery } from '#/front/ui/canvas/layouts/gallery'
import { TileGallery } from '#/front/ui/canvas/tile/gallery'
import { MarksGallery } from '#/front/ui/canvas/tile/marks/gallery'
import { TileMenuGallery } from '#/front/ui/canvas/tile/menu/gallery'
import { MovingGallery } from '#/front/ui/canvas/tile/moving/gallery'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import {
  centerOn,
  readCanvasView,
  viewIn,
  withViewIn,
  type CanvasView,
  type ViewAction,
} from '#/front/ui/canvas/view/view'
import { ChatAtomsGallery } from '#/front/ui/chat/atoms/gallery'
import { Composer } from '#/front/ui/chat/composer/Composer'
import { modeChoices } from '#/front/ui/chat/composer/demo'
import { ComposerGallery } from '#/front/ui/chat/composer/gallery'
import { Events } from '#/front/ui/chat/entries/Events'
import { ChatEntriesGallery } from '#/front/ui/chat/entries/gallery'
import { ChatLayoutsGallery } from '#/front/ui/chat/layouts/gallery'
import { ChatTextGallery } from '#/front/ui/chat/text/gallery'
import { HelpWidgetGallery } from '#/front/ui/chat/widgets/help/gallery'
import { KeyWidgetGallery } from '#/front/ui/chat/widgets/keys/gallery'
import { SignInWidgetGallery } from '#/front/ui/chat/widgets/sign-in/gallery'
import { SignInWidget, type Access } from '#/front/ui/chat/widgets/sign-in/SignInWidget'
import { TileWidgetGallery } from '#/front/ui/chat/widgets/tile/gallery'
import {
  CrossingDemo,
  type CrossingName,
  type CrossingParts,
  type Tell,
  type Where,
} from '#/front/ui/crossings'
import { ChapterSlide, Stage } from '#/front/ui/gallery/deck/Chapter'
import { Lines, ScreenSlide, useDeckKeys, type Go, type Line } from '#/front/ui/gallery/deck/Deck'
import {
  pieceShown,
  piecesOf,
  readDeckSearch,
  type ChapterId,
  type SlideId,
} from '#/front/ui/gallery/deck/slides'
import { ChatPage, canvasTour, OnboardingSlide } from '#/front/ui/gallery/deck/tour'
import { WordsSlide } from '#/front/ui/gallery/deck/words'
import { GallerySection, GalleryState, GalleryTier } from '#/front/ui/gallery/frame'
import { Tokens } from '#/front/ui/gallery/Tokens'
import { LayoutsGallery } from '#/front/ui/layouts/gallery'
import { Screen } from '#/front/ui/layouts/screen/Screen'
import { useScreenState } from '#/front/ui/layouts/screen/state/useScreenState'
import { SeamsGallery } from '#/front/ui/seams/gallery'

/** The page's search params: the deck's slide and piece, and the canvas's view. */
const readDesignSystemSearch = (search: Record<string, unknown>) => ({
  ...readCanvasView(search),
  ...readDeckSearch(search),
})

export const Route = createFileRoute('/design-system')({
  validateSearch: readDesignSystemSearch,
  component: DesignSystem,
})

function DesignSystem() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const slide = search.slide ?? 'why'
  // A slide opens on its own view of the canvas: going to another leaves the last one's behind.
  const go: Go = (to, piece) => {
    void navigate({ search: { slide: to, ...(piece !== undefined && { piece }) } })
  }
  useDeckKeys(slide, go)
  const view = viewIn(search)
  const onViewChange = (next: CanvasView) => {
    void navigate({ search: (current) => withViewIn(current, next), resetScroll: false })
  }
  // A crossing, as on home: a Tile a Message links is centered, the canvas's piece shown.
  const onCenter = (tile: string) => {
    void navigate({
      search: { slide: 'canvas-pieces', piece: 'Canvas', ...centerOn(ulysse, tile) },
    })
  }
  if (slide === 'why' || slide === 'principles') return <WordsSlide slide={slide} onGo={go} />
  return (
    <main className="h-dvh">
      <h1 className="sr-only">{m.design_system_title()}</h1>
      {/* A slide of its own: what the reader wrote on one, and its side in front, stay with it. */}
      <Slide
        key={slide}
        slide={slide}
        piece={search.piece}
        view={view}
        onViewChange={onViewChange}
        onCenter={onCenter}
        onGo={go}
      />
    </main>
  )
}

interface SlideProps {
  slide: Exclude<SlideId, 'why' | 'principles'>
  /** The piece the URL names, which a chapter shows if it is one of its own. */
  piece: string | undefined
  view: CanvasView
  onViewChange: (view: CanvasView) => void
  /** A Tile a Message links, centered on the canvas's piece. */
  onCenter: (tile: string) => void
  onGo: Go
}

/** A slide of the screen: the chat told, and what the canvas shows of it. */
function Slide({ slide, piece, view, onViewChange, onCenter, onGo }: SlideProps) {
  switch (slide) {
    case 'chat':
      return <ScreenSlide slide="chat" onGo={onGo} canvas={<ChatPage />} />
    case 'canvas':
      return <CanvasSlide view={view} onViewChange={onViewChange} onGo={onGo} />
    case 'onboarding':
      return <OnboardingTour onGo={onGo} />
    case 'crossings':
      return <CrossingSlide piece={piece} onGo={onGo} />
    case 'tokens':
      return (
        <ScreenSlide
          slide="tokens"
          onGo={onGo}
          canvas={
            <Stage kicker={m.design_system_title()} title={m.tokens_title()}>
              <Tokens />
            </Stage>
          }
        />
      )
    default:
      return (
        <ChapterSlide
          chapter={slide}
          piece={pieceShown(slide, piece)}
          onGo={onGo}
          specimens={
            <Specimens
              chapter={slide}
              view={view}
              onViewChange={onViewChange}
              onCenter={onCenter}
            />
          }
        />
      )
  }
}

/**
 * The canvas, shown for the first time: its own tile alone and large, folded until a click opens
 * it, the corner saying where you are, and the chat telling where you went, in home's words.
 */
function CanvasSlide(props: {
  view: CanvasView
  onViewChange: (view: CanvasView) => void
  onGo: Go
}) {
  const { view, onViewChange, onGo } = props
  // Read once, in the page's language, whose change loads the page anew.
  const tour = useMemo(canvasTour, [])
  const tellTour = useMemo(() => tellIn(tour), [tour])
  const [went, setWent] = useState<readonly ViewAction[]>([])
  const moved = (next: CanvasView, action: ViewAction) => {
    onViewChange(next)
    setWent([...went, action])
  }
  return (
    <ScreenSlide
      slide="canvas"
      onGo={onGo}
      canvas={
        <div className="flex min-w-0 flex-1 p-4">
          <Canvas
            system={tour}
            view={view}
            onViewChange={moved}
            looking
            className="min-h-0 flex-1"
          />
        </div>
      }
      corner={<Breadcrumb system={tour} view={view} onViewChange={moved} />}
      lines={went.length === 0 ? undefined : <Events lines={[tellTour(went)]} />}
    />
  )
}

/** Whether a piece is a crossing: every piece of the crossings' chapter is. */
const isCrossing = (piece: string): piece is CrossingName =>
  (piecesOf('crossings') as readonly string[]).includes(piece)

/** How to try a crossing, in the chat, and on the canvas where it says. */
const tryOf = ({ tryChat, tryCanvas }: CrossingParts) =>
  tryCanvas === undefined
    ? m.deck_crossing_try_chat({ chat: tryChat })
    : m.deck_crossing_try({ chat: tryChat, canvas: tryCanvas })

/** A crossing on the whole screen, its end in the chat and its end on the canvas, played afresh. */
function CrossingSlide({ piece, onGo }: { piece: string | undefined; onGo: Go }) {
  const shown = pieceShown('crossings', piece)
  if (!isCrossing(shown)) return null
  return (
    <CrossingDemo
      key={shown}
      name={shown}
      previewLimit={previewLimit}
      tell={tell}
      where={where}
      frame={(parts) => (
        <ChapterSlide
          chapter="crossings"
          piece={shown}
          onGo={onGo}
          crossing={{
            canvas: parts.canvas,
            end: parts.end,
            composer: parts.composer,
            tryIt: tryOf(parts),
          }}
        />
      )}
    />
  )
}

interface SpecimensProps {
  chapter: Exclude<ChapterId, 'crossings'>
  view: CanvasView
  onViewChange: (view: CanvasView) => void
  onCenter: (tile: string) => void
}

/** Every gallery of a chapter's tiers, of which the piece shown alone draws its specimens. */
function Specimens({ chapter, view, onViewChange, onCenter }: SpecimensProps) {
  switch (chapter) {
    case 'chat-pieces':
      return (
        <GalleryTier tier="chat">
          <ConversationGallery onCenter={onCenter} />
          <ComposerGallery />
          <ChatTextGallery />
          <ChatEntriesGallery />
          <TileWidgetGallery previewLimit={previewLimit} />
          <KeyWidgetGallery nameLimit={keyNameBounds.max} nameOf={keyNameOf} />
          <ReadBoundary>
            <HelpGallery />
          </ReadBoundary>
          <SignInWidgetGallery />
          <ChatLayoutsGallery />
          <ChatAtomsGallery />
        </GalleryTier>
      )
    case 'canvas-pieces':
      return (
        <GalleryTier tier="canvas">
          <CanvasGallery view={view} onViewChange={onViewChange} />
          <TileGallery />
          <MarksGallery />
          <TileMenuGallery />
          <MovingGallery />
          <BreadcrumbGallery view={view} onViewChange={onViewChange} />
          <CanvasLayoutsGallery />
        </GalleryTier>
      )
    case 'shared':
      return (
        <>
          <GalleryTier tier="layouts">
            <ScreenGallery />
            <ChannelsGallery />
            <LayoutsGallery />
          </GalleryTier>
          <GalleryTier tier="atoms">
            <AtomsGallery />
          </GalleryTier>
          <GalleryTier tier="seams">
            <SeamsGallery />
          </GalleryTier>
        </>
      )
  }
}

/** Each Tile of a System, from its root down. */
const tilesIn = (tile: TileNode): TileNode[] => [
  tile,
  ...[tile.branches, tile.context, tile.leaves].flatMap((ring) =>
    Object.values(ring ?? {}).flatMap(tilesIn),
  ),
]

/**
 * A run of gestures on a canvas of `system`, in home's words: merged as home's sender merges them
 * (Assistant's `merged`), told as the conversation's timeline tells them (`happenedOf`), each Tile
 * by its Title.
 */
function tellIn(system: TileNode): Tell {
  const titles = Object.fromEntries(tilesIn(system).map(({ id, title }) => [id, title]))
  return (gestures) => {
    const navigation = gestures.reduce<Navigation | undefined>(merged, undefined)
    if (navigation === undefined) throw new Error('A navigation is told once a gesture made it')
    return happenedOf({ ...navigation, id: 'navigation', at: new Date() }, { titles })
  }
}

/** A run of gestures on a crossing's canvas, the fixture System's. */
const tell = tellIn(ulysse)

/**
 * Where the Turn answering a crossing's Message works: the Message as home's composer sends it, each
 * link picked written by its Tile's id (`encoded`), then Assistant's own rule (`turnLocation`).
 */
const where: Where = ({ value, links }, center) => turnLocation(encoded(value, links), center)

/**
 * The onboarding, played on into the journey its invitation takes, to the tutorial, read in the
 * page's language as home reads it, beside the slide, never throwing.
 */
function OnboardingTour({ onGo }: { onGo: Go }) {
  const { data } = useShipped('tutorial', getLocale(), { throwing: false })
  const tutorial = useMemo(() => (data === undefined ? undefined : canvasTree(data)), [data])
  return <OnboardingSlide onGo={onGo} tutorial={tutorial} />
}

/** The help widget's section, on Help itself, read in the page's language as `/help` reads it. */
function HelpGallery() {
  const { data: help } = useShipped('help', getLocale())
  if (help === undefined) return <Skeleton className="h-96 w-[37.5rem] max-w-full" />
  return <HelpWidgetGallery help={helpNodeOf(help)} />
}

/** The label of each fixture view; the views themselves are the fixture's, so they cannot drift. */
const views = [
  { label: m.gallery_canvas_view_folded, view: fixtureViews.folded },
  { label: m.gallery_canvas_view_opened, view: fixtureViews.opened },
  { label: m.gallery_canvas_view_split, view: fixtureViews.split },
  { label: m.gallery_canvas_view_expanded, view: fixtureViews.expanded },
  { label: m.gallery_canvas_view_context, view: fixtureViews.context },
  { label: m.gallery_canvas_view_mixed, view: fixtureViews.mixed },
  { label: m.gallery_canvas_view_two_deep, view: fixtureViews.twoDeep },
  { label: m.gallery_canvas_view_leaf, view: fixtureViews.leaf },
]

interface CanvasGalleryProps {
  view: CanvasView
  onViewChange: (next: CanvasView) => void
}

/** The canvas on the fixture System, in the view the address holds, and a link to each fixture view. */
function CanvasGallery({ view, onViewChange }: CanvasGalleryProps) {
  return (
    <GallerySection name="Canvas">
      <div className="grid w-full gap-4">
        <nav aria-label={m.gallery_canvas_views()} className="flex flex-wrap gap-2">
          {views.map(({ label, view: target }) => (
            <Link
              key={label()}
              to="/design-system"
              search={{ slide: 'canvas-pieces', piece: 'Canvas', ...target }}
              resetScroll={false}
              activeOptions={{ exact: true, includeSearch: true }}
              className="px-3 py-1.5 text-sm text-muted-foreground"
              activeProps={{ className: 'bg-muted text-foreground' }}
            >
              {label()}
            </Link>
          ))}
        </nav>
        <p className="max-w-prose text-sm text-muted-foreground">{m.gallery_canvas_how()}</p>
        <Canvas
          system={ulysse}
          view={view}
          onViewChange={onViewChange}
          looking
          className="h-[36rem] max-h-[80dvh] w-full"
        />
      </div>
    </GallerySection>
  )
}

/**
 * The screen, wide and on a phone, signed in on the fixture System and signed out on Help itself, as
 * it ships, each holding its own view and side in front.
 */
function ScreenGallery() {
  const wide = 'h-[40rem] w-[61rem] max-w-full'
  const phone = 'h-[42rem] w-[23.4375rem] max-w-full'
  return (
    <GallerySection name="Screen">
      <GalleryState label={m.gallery_state_wide()}>
        <ScreenSpecimen system={ulysse} signedIn className={wide} />
      </GalleryState>
      <GalleryState label={m.gallery_state_phone()}>
        <ScreenSpecimen system={ulysse} signedIn className={phone} />
      </GalleryState>
      <GalleryState label={m.gallery_state_signed_out()}>
        <ReadBoundary>
          <SignedOutSpecimen className={wide} />
        </ReadBoundary>
      </GalleryState>
      <GalleryState label={m.gallery_state_signed_out_phone()}>
        <ReadBoundary>
          <SignedOutSpecimen className={phone} />
        </ReadBoundary>
      </GalleryState>
    </GallerySection>
  )
}

/** Signed out, the canvas shows Help, read in the page's language as `/help` reads it. */
function SignedOutSpecimen({ className }: { className: string }) {
  const { data: help } = useShipped('help', getLocale())
  if (help === undefined) return <Skeleton className={className} />
  return <ScreenSpecimen system={canvasTree(help)} signedIn={false} className={className} />
}

interface ScreenSpecimenProps {
  system: TileNode
  signedIn: boolean
  className: string
}

/**
 * One screen: a System and a conversation about it signed in, with the Composer at its foot, Help and
 * the sign-in widget at its foot signed out. The conversation's lines are the Chat's `Message`s, enough to
 * show where they sit and how the curve scrolls them.
 */
function ScreenSpecimen({ system, signedIn, className }: ScreenSpecimenProps) {
  const [view, setView] = useState<CanvasView>({})
  const { state: screen, actions: turning } = useScreenState()
  const [sent, setSent] = useState<Line[]>([])
  const lines: Line[] = signedIn
    ? [...screenLines(), ...sent]
    : [
        { voice: 'agent', words: [m.signed_out_help()] },
        { voice: 'agent', words: [m.signed_out_sign_in()] },
      ]
  return (
    <Screen
      front={screen.front}
      onFrontChange={turning.turn}
      className={className}
      canvas={
        <Canvas
          system={system}
          view={view}
          onViewChange={setView}
          looking
          className="flex-1 p-4 pb-8"
        />
      }
      corner={<Breadcrumb system={system} view={view} onViewChange={setView} />}
      messages={<Lines lines={lines} />}
      composer={
        signedIn ? (
          <ScreenComposer
            onSend={(text) => {
              setSent((before) => [...before, { voice: 'human', words: [text], sent: true }])
            }}
          />
        ) : (
          <SignInFoot />
        )
      }
    />
  )
}

const screenLines = (): Line[] => [
  { voice: 'human', words: [m.gallery_screen_line_1()] },
  { voice: 'agent', words: [m.gallery_screen_line_2()] },
  { voice: 'human', words: [m.gallery_screen_line_3()] },
  { voice: 'agent', words: [m.gallery_screen_line_4()] },
  { voice: 'agent', words: [m.gallery_screen_line_5()] },
  { voice: 'human', words: [m.gallery_screen_line_6()] },
]

/**
 * The Composer at the chat's foot, which the screen keeps clear of the curve, where it comes back to
 * the chat's edge. What `/` and `@` list is the Composer's own section's.
 */
function ScreenComposer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState('ask')
  return (
    <Composer
      value={text}
      onChange={setText}
      onPick={() => undefined}
      onLeave={() => undefined}
      onSend={() => {
        onSend(text.trim())
        setText('')
      }}
      mode={{ choices: modeChoices(), on: mode, choose: setMode }}
    />
  )
}

/** Signed out, the chat's foot is the sign-in widget, live: nothing reaches IAM from here. */
function SignInFoot() {
  const [access, setAccess] = useState<Access>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return (
    <SignInWidget
      access={access}
      onAccessChange={setAccess}
      email={email}
      onEmailChange={setEmail}
      password={password}
      onPasswordChange={setPassword}
      onSubmit={() => undefined}
    />
  )
}
