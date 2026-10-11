// The layouts every side shares, on /design-system: the dialog, the table, the page's header, and what a
// place shows instead of its content.
import { FilePlus, Plus, Rows3 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../atoms/controls/act'
import { Button } from '../atoms/controls/button'
import { toast } from '../atoms/Toaster'
import { GallerySection, GalleryState } from '../gallery/frame'
import { ConfirmDialog } from './ConfirmDialog'
import { DataTable, type DataColumn } from './DataTable'
import { Dialog } from './Dialog'
import { PageHeader } from './PageHeader'
import { EmptyState, ErrorState, Forbidden } from './states'

export function LayoutsGallery() {
  return (
    <>
      <TheDialogGallery />
      <DialogGallery />
      <TableGallery />
      <HeaderGallery />
      <StatesGallery />
    </>
  )
}

const done = (what: string) => () => {
  toast(what)
}

// Three acts that stop the user: a tile, a branch whose name is typed first, and an edit that would
// be lost, neutral since nothing is deleted.
function TheDialogGallery() {
  const [open, setOpen] = useState<'tile' | 'branch' | 'discard' | undefined>()
  const close = (next: boolean) => {
    if (!next) setOpen(undefined)
  }
  const openers = [
    { act: 'tile', label: m.gallery_dialog_delete_tile(), state: m.gallery_state_destructive() },
    {
      act: 'branch',
      label: m.gallery_dialog_delete_branch(),
      state: m.gallery_state_dialog_typed(),
    },
    {
      act: 'discard',
      label: m.gallery_dialog_discard_edit(),
      state: m.gallery_state_dialog_neutral(),
    },
  ] as const
  return (
    <GallerySection name="Dialog">
      {openers.map(({ act, label, state }) => (
        <GalleryState key={act} label={state}>
          <Act
            tone={act === 'discard' ? 'quiet' : 'destructive'}
            aria-haspopup="dialog"
            onClick={() => {
              setOpen(act)
            }}
          >
            {label}
          </Act>
        </GalleryState>
      ))}
      <Dialog
        open={open === 'tile'}
        onOpenChange={close}
        kicker={m.gallery_dialog_kicker_delete()}
        title={m.gallery_dialog_tile_title()}
        confirmLabel={m.gallery_dialog_tile_act()}
        onConfirm={done(m.gallery_sample_deleted())}
      >
        <p>{m.gallery_dialog_tile_body()}</p>
      </Dialog>
      <Dialog
        open={open === 'branch'}
        onOpenChange={close}
        kicker={m.gallery_dialog_kicker_delete()}
        title={m.gallery_dialog_branch_title()}
        touches={{ picture: <Touched lit={[2]} />, text: m.gallery_dialog_branch_touches() }}
        typeToConfirm="Site"
        confirmLabel={m.gallery_dialog_branch_act()}
        onConfirm={done(m.gallery_sample_deleted())}
      >
        <p>{m.gallery_dialog_branch_body()}</p>
      </Dialog>
      <Dialog
        open={open === 'discard'}
        onOpenChange={close}
        tone="neutral"
        kicker={m.gallery_dialog_kicker_unsaved()}
        title={m.gallery_dialog_discard_title()}
        cancelLabel={m.gallery_dialog_keep_editing()}
        confirmLabel={m.gallery_dialog_discard_act()}
        onConfirm={done(m.gallery_dialog_discard_act())}
      >
        <p>{m.gallery_dialog_discard_body()}</p>
      </Dialog>
    </GallerySection>
  )
}

// A hex's corners, pointy-top, around its center.
const hexPoints = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, corner) => {
    const angle = (Math.PI / 3) * corner - Math.PI / 2
    return `${(x + r * Math.cos(angle)).toFixed(2)},${(y + r * Math.sin(angle)).toFixed(2)}`
  }).join(' ')

/** A frame in small, its center and the six around it, those the act takes lit in the destructive colour. */
function Touched({ lit }: { lit: readonly number[] }) {
  const r = 7
  const around = Array.from({ length: 6 }, (_, slot) => {
    const angle = (Math.PI / 3) * slot - Math.PI / 6
    return {
      slot: slot + 1,
      x: Math.sqrt(3) * r * Math.cos(angle),
      y: Math.sqrt(3) * r * Math.sin(angle),
    }
  })
  return (
    <svg viewBox="-27 -25 54 50" className="h-[2.625rem] w-[2.875rem] overflow-visible">
      <polygon points={hexPoints(0, 0, r - 0.8)} className="fill-tile stroke-input" />
      {around.map(({ slot, x, y }) => (
        <polygon
          key={slot}
          points={hexPoints(x, y, r - 0.8)}
          className={
            lit.includes(slot) ? 'fill-destructive/22 stroke-destructive' : 'fill-tile stroke-none'
          }
        />
      ))}
    </svg>
  )
}

function DialogGallery() {
  return (
    <GallerySection name="ConfirmDialog">
      <GalleryState label={m.gallery_state_default()}>
        <ConfirmDialog
          trigger={<Button variant="outline">{m.gallery_sample_publish()}</Button>}
          title={m.gallery_sample_publish_title()}
          description={m.gallery_sample_publish_description()}
          confirmLabel={m.gallery_sample_publish()}
          onConfirm={done(m.gallery_sample_published())}
        />
      </GalleryState>
      <GalleryState label={m.gallery_state_destructive()}>
        <ConfirmDialog
          trigger={<Button variant="destructive">{m.gallery_sample_delete()}</Button>}
          title={m.gallery_sample_delete_title()}
          description={m.gallery_sample_delete_description()}
          confirmLabel={m.gallery_sample_delete()}
          onConfirm={done(m.gallery_sample_deleted())}
          destructive
        />
      </GalleryState>
    </GallerySection>
  )
}

interface TileRow {
  id: string
  title: string
  direction: number
  children: number
}

// The six domains of the vault, as a System's first children; titles are messages, read at render.
const tileRows = (): TileRow[] => [
  { id: 'leadership', title: m.gallery_sample_leadership(), direction: 1, children: 4 },
  { id: 'education', title: m.gallery_sample_education(), direction: 2, children: 6 },
  { id: 'games', title: m.gallery_sample_games(), direction: 3, children: 2 },
  { id: 'software', title: m.gallery_sample_software(), direction: 4, children: 5 },
  { id: 'startups', title: m.gallery_sample_startups(), direction: 5, children: 3 },
  { id: 'politics', title: m.gallery_sample_politics(), direction: 6, children: 1 },
]
const noRows: TileRow[] = []

// Headers are messages, read at render in the request's locale.
const tileColumns = (): DataColumn<TileRow>[] => [
  {
    id: 'title',
    header: m.gallery_table_title(),
    cell: (row) => row.title,
    sortValue: (row) => row.title,
  },
  { id: 'direction', header: m.gallery_table_direction(), cell: (row) => row.direction },
  {
    id: 'children',
    header: m.gallery_table_children(),
    cell: (row) => row.children,
    sortValue: (row) => row.children,
    align: 'end',
  },
]

const tileId = (row: TileRow) => row.id

function TableGallery() {
  // The locale changes with a full page load, so the columns are built once.
  const columns = useMemo(tileColumns, [])
  const rows = useMemo(tileRows, [])
  const empty = (
    <EmptyState
      icon={<Rows3 />}
      title={m.gallery_empty_title()}
      description={m.gallery_empty_description()}
      action={
        <Button size="sm">
          <Plus />
          {m.gallery_sample_new_tile()}
        </Button>
      }
    />
  )
  const states = [
    { label: m.gallery_state_rows_sortable(), rows },
    { label: m.gallery_state_loading(), rows: undefined },
    { label: m.gallery_state_empty(), rows: noRows },
  ]
  return (
    <GallerySection name="DataTable">
      {states.map((state) => (
        <GalleryState key={state.label} label={state.label}>
          <div className="w-[28rem] max-w-full">
            <DataTable
              caption={m.gallery_table_caption()}
              columns={columns}
              rows={state.rows}
              rowId={tileId}
              empty={empty}
            />
          </div>
        </GalleryState>
      ))}
    </GallerySection>
  )
}

function HeaderGallery() {
  return (
    <GallerySection name="PageHeader">
      <GalleryState label={m.gallery_state_complete()}>
        <div className="w-[36rem] max-w-full">
          <PageHeader
            title={m.gallery_sample_page_title()}
            description={m.gallery_sample_page_description()}
            actions={
              <Button>
                <Plus />
                {m.gallery_sample_new_tile()}
              </Button>
            }
          />
        </div>
      </GalleryState>
      <GalleryState label={m.gallery_state_title_only()}>
        <div className="w-[36rem] max-w-full">
          <PageHeader title={m.gallery_sample_page_title()} />
        </div>
      </GalleryState>
    </GallerySection>
  )
}

const retry = () => {
  toast(m.gallery_sample_retrying())
}

function StatesGallery() {
  return (
    <>
      <GallerySection name="EmptyState">
        <GalleryState label={m.gallery_state_with_action()}>
          <div className="w-80">
            <EmptyState
              icon={<FilePlus />}
              title={m.gallery_empty_title()}
              description={m.gallery_empty_description()}
              action={
                <Button size="sm">
                  <Plus />
                  {m.gallery_sample_new_tile()}
                </Button>
              }
            />
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_title_only()}>
          <div className="w-80">
            <EmptyState title={m.gallery_empty_title()} />
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="ErrorState">
        <GalleryState label={m.gallery_state_with_retry()}>
          <div className="w-80">
            <ErrorState requestId="req_01J9Z8X7W6V5" onRetry={retry} />
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_with_message()}>
          <div className="w-80">
            <ErrorState message={m.gallery_sample_error_message()} />
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Forbidden">
        <GalleryState label={m.gallery_state_default()}>
          <div className="w-80">
            <Forbidden />
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_with_message()}>
          <div className="w-80">
            <Forbidden message={m.gallery_sample_forbidden_message()} />
          </div>
        </GalleryState>
      </GallerySection>
    </>
  )
}
