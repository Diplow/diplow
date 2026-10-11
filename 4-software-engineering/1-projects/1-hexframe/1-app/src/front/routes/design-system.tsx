// The design system, for anyone, in production too, read top-down: the direction, then a section per
// tier, the crossings, the Chat, the Canvas, the layouts and the atoms the sides share, the seams, each
// piece in its states, then the tokens. The canvas's view lives in the search params, so a link shows
// what its sender saw, and a Message's link in the Conversation centers it, as on home.
import { Link, createFileRoute } from '@tanstack/react-router'

import { ChannelsGallery } from '#/front/client/gallery'
import { BreadcrumbGallery } from '#/front/features/breadcrumb/gallery'
import { ConversationGallery } from '#/front/features/conversation/gallery'
import { m } from '#/paraglide/messages'
import { AtomsGallery } from '#/front/ui/atoms/gallery'
import { Canvas } from '#/front/ui/canvas/Canvas'
import { CanvasAtomsGallery } from '#/front/ui/canvas/atoms/gallery'
import { fixtureViews, ulysse } from '#/front/ui/canvas/fixtures'
import { CanvasLayoutsGallery } from '#/front/ui/canvas/layouts/gallery'
import { centerOn, readCanvasView, type CanvasView } from '#/front/ui/canvas/view/view'
import { ChatAtomsGallery } from '#/front/ui/chat/atoms/gallery'
import { ChatLayoutsGallery } from '#/front/ui/chat/layouts/gallery'
import { GallerySection, GalleryTier, tierAnchor, tierTitle } from '#/front/ui/gallery/frame'
import { anchorOf, filled, tiers } from '#/front/ui/gallery/pieces'
import { Tokens } from '#/front/ui/gallery/Tokens'
import { LayoutsGallery } from '#/front/ui/layouts/gallery'
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
        <ChatLayoutsGallery />
        <ChatAtomsGallery />
      </GalleryTier>
      <GalleryTier tier="canvas">
        <CanvasGallery view={view} onViewChange={onViewChange} />
        <BreadcrumbGallery view={view} onViewChange={onViewChange} />
        <CanvasLayoutsGallery />
        <CanvasAtomsGallery />
      </GalleryTier>
      <GalleryTier tier="layouts">
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
