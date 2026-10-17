// The canvas's own layouts, on /design-system: its corner, where you are.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { GallerySection, GalleryState } from '../../gallery/frame'
import { cornerPlace } from '../../layouts/screen/Screen'
import { ulysse } from '../fixtures'
import { pathTo } from '../view/tiles'
import { Rail } from './Rail'

export function CanvasLayoutsGallery() {
  return (
    <>
      <GallerySection name="Rail">
        <GalleryState label={m.gallery_state_at_the_root()}>
          <RailSpecimen from={ulysse.id} />
        </GalleryState>
        <GalleryState label={m.gallery_state_one_level_down()}>
          <RailSpecimen from="software-engineering" />
        </GalleryState>
        <GalleryState label={m.gallery_state_three_levels_down()}>
          <RailSpecimen from="hexframe" />
        </GalleryState>
      </GallerySection>
    </>
  )
}

// The corner of a canvas on the fixture System, from a Tile down the vault; a step up centers on it.
function RailSpecimen({ from }: { from: string }) {
  const [here, setHere] = useState(from)
  return (
    <div className="relative h-72 w-80 bg-background">
      <Rail steps={pathTo(ulysse, here)} onSelect={setHere} className={cornerPlace} />
    </div>
  )
}
