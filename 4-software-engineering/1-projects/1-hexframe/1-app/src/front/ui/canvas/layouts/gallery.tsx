// The canvas's own layouts, on /design-system: its corner, where you are, the centered Tile's card and
// the drawer its forms open in.
import { Settings } from 'lucide-react'
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../../atoms/controls/button'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { ulysse } from '../fixtures'
import { pathTo } from '../view/tiles'
import { Card } from './Card'
import { Drawer } from './Drawer'
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
      <GallerySection name="Card">
        <GalleryState label={m.gallery_state_complete()}>
          <Card
            className="w-80"
            title={m.gallery_sample_tile_title()}
            description={m.gallery_sample_tile_preview()}
            action={
              <Button size="icon-sm" variant="ghost" aria-label={m.gallery_sample_settings()}>
                <Settings />
              </Button>
            }
            footer={<Button size="sm">{m.gallery_sample_open()}</Button>}
          >
            <p className="text-sm">{m.gallery_sample_tile_body()}</p>
          </Card>
        </GalleryState>
        <GalleryState label={m.gallery_state_content_only()}>
          <Card className="w-80">
            <p className="text-sm">{m.gallery_sample_tile_body()}</p>
          </Card>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Drawer">
        <GalleryState label={m.gallery_state_click_to_open()}>
          <DrawerSpecimen />
        </GalleryState>
      </GallerySection>
    </>
  )
}

// On a real page, the drawer's open state is a search param; here a demo holds it.
function DrawerSpecimen() {
  const [open, setOpen] = useState(false)
  const close = () => {
    setOpen(false)
  }
  return (
    <>
      <Button
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true)
        }}
      >
        {m.gallery_sample_edit()}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={m.gallery_sample_tile_title()}
        description={m.gallery_sample_tile_preview()}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              {m.ui_cancel()}
            </Button>
            <Button onClick={close}>{m.gallery_sample_save()}</Button>
          </>
        }
      >
        <p className="text-sm">{m.gallery_sample_tile_body()}</p>
      </Drawer>
    </>
  )
}

// The corner of a canvas on the fixture System, from a Tile down the vault; a step up centers on it.
function RailSpecimen({ from }: { from: string }) {
  const [here, setHere] = useState(from)
  return (
    <div className="relative h-72 w-80 bg-background">
      <Rail
        steps={pathTo(ulysse, here)}
        onSelect={setHere}
        className="absolute top-[1.375rem] right-[1.375rem]"
      />
    </div>
  )
}
