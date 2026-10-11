// The canvas's own atoms, on /design-system: the tooltip a Tile's hover card is drawn with.
import { Copy } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { Button } from '../../atoms/controls/button'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { Tooltip } from './Tooltip'

export function CanvasAtomsGallery() {
  return (
    <GallerySection name="Tooltip">
      <GalleryState label={m.gallery_state_hover_or_focus()}>
        <Tooltip content={m.gallery_sample_copy_link()}>
          <Button variant="outline" size="icon" aria-label={m.gallery_sample_copy_link()}>
            <Copy />
          </Button>
        </Tooltip>
      </GalleryState>
    </GallerySection>
  )
}
