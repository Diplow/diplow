import { Plus, Settings } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { GallerySection, GalleryState } from '../gallery'
import { Button } from '../inputs/controls/button'
import { Card } from './Card'
import { PageHeader } from './PageHeader'

export function SurfacesGallery() {
  return (
    <>
      <GallerySection name="Card">
        <GalleryState label={m.dev_ui_state_complete()}>
          <Card
            className="w-80"
            title={m.dev_ui_sample_tile_title()}
            description={m.dev_ui_sample_tile_preview()}
            action={
              <Button size="icon-sm" variant="ghost" aria-label={m.dev_ui_sample_settings()}>
                <Settings />
              </Button>
            }
            footer={<Button size="sm">{m.dev_ui_sample_open()}</Button>}
          >
            <p className="text-sm">{m.dev_ui_sample_tile_body()}</p>
          </Card>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_content_only()}>
          <Card className="w-80">
            <p className="text-sm">{m.dev_ui_sample_tile_body()}</p>
          </Card>
        </GalleryState>
      </GallerySection>
      <GallerySection name="PageHeader">
        <GalleryState label={m.dev_ui_state_complete()}>
          <div className="w-[36rem] max-w-full">
            <PageHeader
              title={m.dev_ui_sample_page_title()}
              description={m.dev_ui_sample_page_description()}
              actions={
                <Button>
                  <Plus />
                  {m.dev_ui_sample_new_tile()}
                </Button>
              }
            />
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_title_only()}>
          <div className="w-[36rem] max-w-full">
            <PageHeader title={m.dev_ui_sample_page_title()} />
          </div>
        </GalleryState>
      </GallerySection>
    </>
  )
}
