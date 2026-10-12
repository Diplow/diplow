// The canvas's own atoms, on /design-system: the theme's disc, which heads the canvas's corner; here
// it changes the page itself, as there.
import { m } from '#/paraglide/messages'

import { GallerySection, GalleryState } from '../../gallery/frame'
import { ThemeToggle } from './ThemeToggle'

export function CanvasAtomsGallery() {
  return (
    <>
      <GallerySection name="ThemeToggle">
        <GalleryState label={m.gallery_state_click_to_switch()}>
          <ThemeToggle />
        </GalleryState>
      </GallerySection>
    </>
  )
}
