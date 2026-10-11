// The canvas's own layouts, on /design-system: the tile's hover card, the centered Tile's card and the
// drawer its forms open in.
import { Settings } from 'lucide-react'
import { useState, type ComponentProps } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../../atoms/controls/button'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { Card } from './Card'
import { Drawer } from './Drawer'
import { HoverCard } from './HoverCard'

export function CanvasLayoutsGallery() {
  return (
    <>
      <GallerySection name="HoverCard">
        <GalleryState label={m.gallery_state_hover_or_focus()}>
          <HoverCard
            place={m.gallery_sample_tile_place()}
            title={m.gallery_sample_tile_title()}
            description={m.gallery_sample_tile_preview_long()}
          >
            <SpecimenTile>{m.gallery_sample_tile_title()}</SpecimenTile>
          </HoverCard>
        </GalleryState>
        <GalleryState label={m.gallery_state_hover_card_clash()}>
          <HoverCard
            place={m.gallery_sample_leaf_place()}
            title={m.gallery_sample_leaf_title()}
            description={m.gallery_sample_leaf_preview()}
            note={{ text: m.gallery_sample_leaf_clash(), tone: 'warning' }}
          >
            <SpecimenTile>{m.gallery_sample_leaf_title()}</SpecimenTile>
          </HoverCard>
        </GalleryState>
        <GalleryState label={m.gallery_state_hover_card_agent()}>
          <HoverCard
            place={m.gallery_sample_tile_place()}
            title={m.gallery_sample_tile_title()}
            description={m.gallery_sample_tile_preview()}
            note={{ text: m.gallery_sample_agent_here(), tone: 'agent' }}
          >
            <SpecimenTile>{m.gallery_sample_tile_title()}</SpecimenTile>
          </HoverCard>
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

/**
 * A tile as the canvas lights it: a fill, lighter under the pointer and on focus. It hands on what the
 * hover card gives its trigger, its ref and its handlers.
 */
function SpecimenTile(props: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className="grid h-32 w-28 cursor-default place-items-center bg-tile px-3 text-center font-human text-sm text-foreground transition-colors [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)] hover:bg-tile-lit focus-visible:bg-tile-lit focus-visible:underline focus-visible:decoration-human focus-visible:underline-offset-4 focus-visible:outline-none"
    />
  )
}
