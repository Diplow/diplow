// The layouts every side shares, in /dev/ui: the dialog, the table, the page's header, and what a
// place shows instead of its content.
import { FilePlus, Plus, Rows3 } from 'lucide-react'
import { useMemo } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../atoms/controls/button'
import { toast } from '../atoms/Toaster'
import { GallerySection, GalleryState } from '../gallery'
import { ConfirmDialog } from './ConfirmDialog'
import { DataTable, type DataColumn } from './DataTable'
import { PageHeader } from './PageHeader'
import { EmptyState, ErrorState, Forbidden } from './states'

export function LayoutsGallery() {
  return (
    <>
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

function DialogGallery() {
  return (
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
  { id: 'leadership', title: m.dev_ui_sample_leadership(), direction: 1, children: 4 },
  { id: 'education', title: m.dev_ui_sample_education(), direction: 2, children: 6 },
  { id: 'games', title: m.dev_ui_sample_games(), direction: 3, children: 2 },
  { id: 'software', title: m.dev_ui_sample_software(), direction: 4, children: 5 },
  { id: 'startups', title: m.dev_ui_sample_startups(), direction: 5, children: 3 },
  { id: 'politics', title: m.dev_ui_sample_politics(), direction: 6, children: 1 },
]
const noRows: TileRow[] = []

// Headers are messages, read at render in the request's locale.
const tileColumns = (): DataColumn<TileRow>[] => [
  {
    id: 'title',
    header: m.dev_ui_table_title(),
    cell: (row) => row.title,
    sortValue: (row) => row.title,
  },
  { id: 'direction', header: m.dev_ui_table_direction(), cell: (row) => row.direction },
  {
    id: 'children',
    header: m.dev_ui_table_children(),
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
      title={m.dev_ui_empty_title()}
      description={m.dev_ui_empty_description()}
      action={
        <Button size="sm">
          <Plus />
          {m.dev_ui_sample_new_tile()}
        </Button>
      }
    />
  )
  const states = [
    { label: m.dev_ui_state_rows_sortable(), rows },
    { label: m.dev_ui_state_loading(), rows: undefined },
    { label: m.dev_ui_state_empty(), rows: noRows },
  ]
  return (
    <GallerySection name="DataTable">
      {states.map((state) => (
        <GalleryState key={state.label} label={state.label}>
          <div className="w-[28rem] max-w-full">
            <DataTable
              caption={m.dev_ui_table_caption()}
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
  )
}

const retry = () => {
  toast(m.dev_ui_sample_retrying())
}

function StatesGallery() {
  return (
    <>
      <GallerySection name="EmptyState">
        <GalleryState label={m.dev_ui_state_with_action()}>
          <div className="w-80">
            <EmptyState
              icon={<FilePlus />}
              title={m.dev_ui_empty_title()}
              description={m.dev_ui_empty_description()}
              action={
                <Button size="sm">
                  <Plus />
                  {m.dev_ui_sample_new_tile()}
                </Button>
              }
            />
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_title_only()}>
          <div className="w-80">
            <EmptyState title={m.dev_ui_empty_title()} />
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="ErrorState">
        <GalleryState label={m.dev_ui_state_with_retry()}>
          <div className="w-80">
            <ErrorState requestId="req_01J9Z8X7W6V5" onRetry={retry} />
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_with_message()}>
          <div className="w-80">
            <ErrorState message={m.dev_ui_sample_error_message()} />
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Forbidden">
        <GalleryState label={m.dev_ui_state_default()}>
          <div className="w-80">
            <Forbidden />
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_with_message()}>
          <div className="w-80">
            <Forbidden message={m.dev_ui_sample_forbidden_message()} />
          </div>
        </GalleryState>
      </GallerySection>
    </>
  )
}
