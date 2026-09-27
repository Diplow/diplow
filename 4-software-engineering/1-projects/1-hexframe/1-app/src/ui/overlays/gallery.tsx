import { Copy, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../feedback/Toaster'
import { GallerySection, GalleryState } from '../gallery'
import { Button } from '../inputs/controls/button'
import { ConfirmDialog } from './ConfirmDialog'
import { Drawer } from './Drawer'
import { DropdownMenu, type MenuEntry } from './DropdownMenu'
import { Tooltip } from './Tooltip'

const done = (what: string) => () => {
  toast(what)
}

// Messages are read at render, in the request's locale, never at module load.
const menuEntries = (): MenuEntry[] => [
  { label: m.dev_ui_sample_edit(), icon: <Pencil />, onSelect: done(m.dev_ui_sample_edit()) },
  {
    label: m.dev_ui_sample_copy_link(),
    icon: <Copy />,
    onSelect: done(m.dev_ui_sample_copy_link()),
  },
  {
    label: m.dev_ui_sample_share(),
    icon: <Share2 />,
    onSelect: done(m.dev_ui_sample_share()),
    disabled: true,
  },
  'separator',
  {
    label: m.dev_ui_sample_delete(),
    icon: <Trash2 />,
    onSelect: done(m.dev_ui_sample_delete()),
    destructive: true,
  },
]

export function OverlaysGallery() {
  return (
    <>
      <GallerySection name="Drawer">
        <GalleryState label={m.dev_ui_state_click_to_open()}>
          <DrawerSpecimen />
        </GalleryState>
      </GallerySection>
      <GallerySection name="ConfirmDialog">
        <GalleryState label={m.dev_ui_state_default()}>
          <ConfirmDialog
            trigger={<Button variant="outline">{m.dev_ui_sample_publish()}</Button>}
            title={m.dev_ui_sample_publish_title()}
            description={m.dev_ui_sample_publish_description()}
            confirmLabel={m.dev_ui_sample_publish()}
            onConfirm={done(m.dev_ui_sample_published())}
          />
        </GalleryState>
        <GalleryState label={m.dev_ui_state_destructive()}>
          <ConfirmDialog
            trigger={<Button variant="destructive">{m.dev_ui_sample_delete()}</Button>}
            title={m.dev_ui_sample_delete_title()}
            description={m.dev_ui_sample_delete_description()}
            confirmLabel={m.dev_ui_sample_delete()}
            onConfirm={done(m.dev_ui_sample_deleted())}
            destructive
          />
        </GalleryState>
      </GallerySection>
      <GallerySection name="DropdownMenu">
        <GalleryState label={m.dev_ui_state_menu()}>
          <DropdownMenu
            label={m.dev_ui_sample_tile_title()}
            entries={menuEntries()}
            trigger={
              <Button variant="outline" size="icon" aria-label={m.dev_ui_sample_actions()}>
                <MoreHorizontal />
              </Button>
            }
          />
        </GalleryState>
      </GallerySection>
      <GallerySection name="Tooltip">
        <GalleryState label={m.dev_ui_state_hover_or_focus()}>
          <Tooltip content={m.dev_ui_sample_copy_link()}>
            <Button variant="outline" size="icon" aria-label={m.dev_ui_sample_copy_link()}>
              <Copy />
            </Button>
          </Tooltip>
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
        onClick={() => {
          setOpen(true)
        }}
      >
        {m.dev_ui_sample_edit()}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={m.dev_ui_sample_tile_title()}
        description={m.dev_ui_sample_tile_preview()}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              {m.ui_cancel()}
            </Button>
            <Button onClick={close}>{m.dev_ui_sample_save()}</Button>
          </>
        }
      >
        <p className="text-sm">{m.dev_ui_sample_tile_body()}</p>
      </Drawer>
    </>
  )
}
