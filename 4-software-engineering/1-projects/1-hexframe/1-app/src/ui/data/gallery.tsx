import { Plus, Rows3 } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { EmptyState } from '../feedback/states'
import { GallerySection, GalleryState } from '../gallery'
import { Button } from '../inputs/controls/button'
import { DataTable, type DataColumn } from './DataTable'

interface TileRow {
  id: string
  title: string
  direction: number
  children: number
}

const rows: TileRow[] = [
  { id: 'leadership', title: 'Leadership', direction: 1, children: 4 },
  { id: 'education', title: 'Education', direction: 2, children: 6 },
  { id: 'games', title: 'Games', direction: 3, children: 2 },
  { id: 'software', title: 'Software Engineering', direction: 4, children: 5 },
  { id: 'startups', title: 'Startups', direction: 5, children: 3 },
  { id: 'politics', title: 'Politics', direction: 6, children: 1 },
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

export function DataGallery() {
  const columns = tileColumns()
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
