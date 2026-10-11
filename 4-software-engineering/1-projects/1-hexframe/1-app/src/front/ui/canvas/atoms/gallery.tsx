// The canvas's own atoms, in /dev/ui: the tooltip a Tile's hover card is drawn with.
import { Copy } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { Button } from '../../atoms/controls/button'
import { GallerySection, GalleryState } from '../../gallery'
import { Tooltip } from './Tooltip'

export function CanvasAtomsGallery() {
  return (
    <GallerySection name="Tooltip">
      <GalleryState label={m.dev_ui_state_hover_or_focus()}>
        <Tooltip content={m.dev_ui_sample_copy_link()}>
          <Button variant="outline" size="icon" aria-label={m.dev_ui_sample_copy_link()}>
            <Copy />
          </Button>
        </Tooltip>
      </GalleryState>
    </GallerySection>
  )
}
