// The Breadcrumb on /design-system, over the fixture System, in the view the page's canvas shows, in a
// canvas's corner: a step centers that canvas, as on home.
import { m } from '#/paraglide/messages'
import { ulysse } from '#/front/ui/canvas/fixtures'
import type { CanvasView, ViewAction } from '#/front/ui/canvas/view/view'
import { GallerySection, GalleryState } from '#/front/ui/gallery/frame'

import { Breadcrumb } from './Breadcrumb'

interface BreadcrumbGalleryProps {
  view: CanvasView
  onViewChange: (view: CanvasView, action: ViewAction) => void
}

export function BreadcrumbGallery({ view, onViewChange }: BreadcrumbGalleryProps) {
  return (
    <GallerySection name="Breadcrumb">
      <GalleryState label={m.gallery_state_follows_the_canvas()}>
        <div className="relative h-72 w-80 bg-background">
          <Breadcrumb
            system={ulysse}
            view={view}
            onViewChange={onViewChange}
            className="absolute top-[1.375rem] right-[1.375rem]"
          />
        </div>
      </GalleryState>
    </GallerySection>
  )
}
