// The Breadcrumb on /design-system, over the fixture System, in the view the page's canvas shows, in a
// canvas's corner: a step centers that canvas, as on home. And the hex widget, live on the same System
// as though its page were open, as the chat's foot draws it: a click on a tile turns it to that tile.
import { useState } from 'react'

import { m } from '#/paraglide/messages'
import { ulysse } from '#/front/ui/canvas/fixtures'
import type { CanvasView, ViewAction } from '#/front/ui/canvas/view/view'
import { GallerySection, GalleryState } from '#/front/ui/gallery/frame'
import { cornerPlace } from '#/front/ui/layouts/screen/Screen'

import { Breadcrumb } from './Breadcrumb'
import { HexWidget } from './HexWidget'

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
            className={cornerPlace}
          />
        </div>
      </GalleryState>
    </GallerySection>
  )
}

export function HexWidgetGallery() {
  const [view, setView] = useState<CanvasView>({ center: ulysse.id, page: true })
  return (
    <GallerySection name="HexWidget">
      <GalleryState label={m.gallery_state_hex_widget()}>
        <div className="w-[28rem] max-w-full">
          <HexWidget system={ulysse} view={view} onViewChange={setView} sun={{ light: 'human' }} />
        </div>
      </GalleryState>
    </GallerySection>
  )
}
