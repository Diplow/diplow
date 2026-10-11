// The design system, for anyone, in production too, read top-down: the direction, then a section per
// tier, the crossings, the Chat, the Canvas, the layouts and the atoms the sides share, the seams, each
// piece in its states, then the tokens. The canvas's view lives in the search params, so a link shows
// what its sender saw, and a Message's link in the Conversation centers it, as on home. The Screen's
// specimens are drawn here too, since they lay out both sides, which no folder of ui/ may import.
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { ChannelsGallery } from '#/front/client/gallery'
import { ReadBoundary } from '#/front/client/ReadBoundary'
import { useHelp } from '#/front/client/mapping/queries'
import { BreadcrumbGallery } from '#/front/features/breadcrumb/gallery'
import { ConversationGallery } from '#/front/features/conversation/gallery'
import { canvasTree } from '#/front/features/system/tree'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { Skeleton } from '#/front/ui/atoms/skeleton'
import { AtomsGallery } from '#/front/ui/atoms/gallery'
import { Canvas } from '#/front/ui/canvas/Canvas'
import { CanvasAtomsGallery } from '#/front/ui/canvas/atoms/gallery'
import { fixtureViews, ulysse } from '#/front/ui/canvas/fixtures'
import { CanvasLayoutsGallery } from '#/front/ui/canvas/layouts/gallery'
import { TileGallery } from '#/front/ui/canvas/tile/gallery'
import { Rail } from '#/front/ui/canvas/layouts/Rail'
import { pathTo, type TileNode } from '#/front/ui/canvas/view/tiles'
import { centerOn, readCanvasView, showView, type CanvasView } from '#/front/ui/canvas/view/view'
import { ChatAtomsGallery } from '#/front/ui/chat/atoms/gallery'
import { Composer } from '#/front/ui/chat/composer/Composer'
import { modeChoices } from '#/front/ui/chat/composer/demo'
import { ComposerGallery } from '#/front/ui/chat/composer/gallery'
import { ChatEntriesGallery } from '#/front/ui/chat/entries/gallery'
import { ChatLayoutsGallery } from '#/front/ui/chat/layouts/gallery'
import { ChatTextGallery } from '#/front/ui/chat/text/gallery'
import { Message } from '#/front/ui/chat/text/Message'
import {
  GallerySection,
  GalleryState,
  GalleryTier,
  tierAnchor,
  tierTitle,
} from '#/front/ui/gallery/frame'
import { anchorOf, filled, tiers } from '#/front/ui/gallery/pieces'
import { Tokens } from '#/front/ui/gallery/Tokens'
import { LayoutsGallery } from '#/front/ui/layouts/gallery'
import { Screen, type Side } from '#/front/ui/layouts/screen/Screen'
import { SeamsGallery } from '#/front/ui/seams/gallery'

export const Route = createFileRoute('/design-system')({
  validateSearch: readCanvasView,
  component: DesignSystem,
})

function DesignSystem() {
  const view = Route.useSearch()
  const navigate = Route.useNavigate()
  const onViewChange = (next: CanvasView) => {
    void navigate({ search: next, resetScroll: false })
  }
  // A crossing, as on home: a Tile a Message links is centered, and the page goes to the canvas.
  const onCenter = (tile: string) => {
    void navigate({ search: centerOn(ulysse, tile), hash: anchorOf('Canvas') })
  }
  return (
    <main className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-16 px-6 pb-16">
      <Direction />
      <GalleryTier tier="crossings" />
      <GalleryTier tier="chat">
        <ConversationGallery onCenter={onCenter} />
        <ComposerGallery />
        <ChatTextGallery />
        <ChatEntriesGallery />
        <ChatLayoutsGallery />
        <ChatAtomsGallery />
      </GalleryTier>
      <GalleryTier tier="canvas">
        <CanvasGallery view={view} onViewChange={onViewChange} />
        <TileGallery />
        <BreadcrumbGallery view={view} onViewChange={onViewChange} />
        <CanvasLayoutsGallery />
        <CanvasAtomsGallery />
      </GalleryTier>
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
      <Tokens />
    </main>
  )
}

const principles = [
  { title: m.design_system_principle_space, text: m.design_system_principle_space_text },
  { title: m.design_system_principle_light, text: m.design_system_principle_light_text },
  { title: m.design_system_principle_root, text: m.design_system_principle_root_text },
  { title: m.design_system_principle_voices, text: m.design_system_principle_voices_text },
  { title: m.design_system_principle_curves, text: m.design_system_principle_curves_text },
  { title: m.design_system_principle_motion, text: m.design_system_principle_motion_text },
]

/** The direction, in short, and the way down the page. */
function Direction() {
  return (
    <header className="grid gap-8 pt-6">
      <div className="grid gap-4">
        <h1 className="text-5xl font-light">{m.design_system_title()}</h1>
        <p className="max-w-prose font-human text-prose font-light">{m.design_system_intro()}</p>
      </div>
      <ol className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {principles.map(({ title, text }) => (
          <li key={title()} className="grid content-start gap-1">
            <h2 className="text-lg">{title()}</h2>
            <p className="text-sm text-muted-foreground">{text()}</p>
          </li>
        ))}
      </ol>
      <p className="max-w-prose text-sm">{m.design_system_screen()}</p>
      <nav aria-label={m.design_system_contents()}>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {tiers.filter(filled).map((tier) => (
            <li key={tier}>
              <a
                href={`#${tierAnchor(tier)}`}
                className="text-muted-foreground hover:text-foreground"
              >
                {tierTitle(tier)}
              </a>
            </li>
          ))}
          <li>
            <a href="#tokens" className="text-muted-foreground hover:text-foreground">
              {m.tokens_title()}
            </a>
          </li>
        </ul>
      </nav>
    </header>
  )
}

/** The label of each fixture view; the views themselves are the fixture's, so they cannot drift. */
const views = [
  { label: m.gallery_canvas_view_root, view: fixtureViews.root },
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
              search={target}
              hash={anchorOf('Canvas')}
              resetScroll={false}
              activeOptions={{ exact: true, includeSearch: true, includeHash: false }}
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

interface Line {
  author: 'user' | 'agent'
  text: string
  /** Sent from the specimen's composer, so shown at once. */
  sent?: true
}

/** Signed out, the canvas shows Help, read in the page's language as `/help` reads it. */
function SignedOutSpecimen({ className }: { className: string }) {
  const { data: help } = useHelp(getLocale())
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
 * the sign-in widget's place signed out. The conversation's lines are the Chat's `Message`s, enough to
 * show where they sit and how the curve scrolls them.
 */
function ScreenSpecimen({ system, signedIn, className }: ScreenSpecimenProps) {
  const [view, setView] = useState<CanvasView>({})
  const [front, setFront] = useState<Side>('chat')
  const [sent, setSent] = useState<Line[]>([])
  const lines: Line[] = signedIn
    ? [...screenLines(), ...sent]
    : [
        { author: 'agent', text: m.gallery_screen_signed_out_1() },
        { author: 'agent', text: m.gallery_screen_signed_out_2() },
      ]
  return (
    <Screen
      front={front}
      onFrontChange={setFront}
      className={className}
      canvas={
        <Canvas system={system} view={view} onViewChange={setView} className="flex-1 p-4 pb-8" />
      }
      corner={
        <Rail
          steps={pathTo(system, showView(system, view).center.id)}
          onSelect={(id) => {
            setView(centerOn(system, id))
          }}
        />
      }
      messages={<Lines lines={lines} />}
      composer={
        signedIn ? (
          <ScreenComposer
            onSend={(text) => {
              setSent((before) => [...before, { author: 'user', text, sent: true }])
            }}
          />
        ) : (
          <SignInPlace />
        )
      }
    />
  )
}

const screenLines = (): Line[] => [
  { author: 'user', text: m.gallery_screen_line_1() },
  { author: 'agent', text: m.gallery_screen_line_2() },
  { author: 'user', text: m.gallery_screen_line_3() },
  { author: 'agent', text: m.gallery_screen_line_4() },
  { author: 'agent', text: m.gallery_screen_line_5() },
  { author: 'user', text: m.gallery_screen_line_6() },
]

/** The conversation in its two voices (`Message`), the mark on the first of an agent's run alone. */
function Lines({ lines }: { lines: Line[] }) {
  return (
    <ol className="flex flex-col gap-[1.375rem]">
      {lines.map((line, index) => (
        <li key={index} ref={line.sent ? scrollToFoot : undefined}>
          {line.author === 'user' ? (
            <Message voice="human" words={[line.text]} />
          ) : (
            <Message
              voice="agent"
              words={[line.text]}
              continued={lines[index - 1]?.author === 'agent'}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

/** A line just sent shows at once: its conversation, and not the page, scrolls to its foot. */
function scrollToFoot(element: HTMLElement | null) {
  const messages = element?.closest<HTMLElement>('[role="region"]')
  if (messages) messages.scrollTop = messages.scrollHeight
}

/** A zone, the chat's foot: a solid fill with one fine line on top, warm for you. */
const zone =
  'relative flex min-h-[7.25rem] items-center gap-4 bg-card bg-linear-to-r from-transparent from-15% to-human/9 px-5 py-6 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-input before:via-45% before:to-input @wide:pr-[4.125rem] @wide:pl-9'

/**
 * The Composer at the chat's foot, its padding clear of the curve, which comes back to the chat's edge
 * there. What `/` and `@` list is the Composer's own section's.
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
      className="sm:px-4 @wide:pr-[4.125rem] @wide:pl-9"
    />
  )
}

/** Signed out, the chat's foot is where the sign-in widget sits (HEX-100), drawn here as its place. */
function SignInPlace() {
  return (
    <div className={zone}>
      <div className="grid gap-1">
        <span className="font-agent text-xs text-agent">{m.gallery_screen_sign_in_kicker()}</span>
        <span className="font-human text-xl">{m.gallery_screen_sign_in_title()}</span>
        <span className="text-sm font-light text-muted-foreground">
          {m.gallery_screen_sign_in_text()}
        </span>
      </div>
    </div>
  )
}
