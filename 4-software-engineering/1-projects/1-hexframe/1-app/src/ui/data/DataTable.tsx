import {
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'
import { cn } from 'cn'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'

import { Skeleton } from '../feedback/skeleton'

/** A column, described without TanStack Table: a feature never imports it. */
export interface DataColumn<TRow> {
  id: string
  header: string
  cell: (row: TRow) => ReactNode
  /** Makes the column sortable, by this value. */
  sortValue?: (row: TRow) => string | number
  align?: 'start' | 'end'
}

interface DataTableProps<TRow> {
  /** Keep the array stable across renders (module scope or `useMemo`): a new one rebuilds the table. */
  columns: readonly DataColumn<TRow>[]
  /** `undefined` while loading, as TanStack Query's `data` is. */
  rows: readonly TRow[] | undefined
  rowId: (row: TRow) => string
  /** Shown when there are no rows: an EmptyState. */
  empty: ReactNode
  /** Names the table for assistive technology. */
  caption: string
}

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() })
type Features = typeof features

const loadingRows = 3
const noRows: readonly never[] = []

function toColumnDef<TRow extends RowData>(column: DataColumn<TRow>): ColumnDef<Features, TRow> {
  const { id, header, cell, sortValue } = column
  const render = ({ row }: { row: { original: TRow } }) => cell(row.original)
  return sortValue
    ? { id, header, cell: render, accessorFn: sortValue }
    : { id, header, cell: render, enableSorting: false }
}

const ariaSort = { asc: 'ascending', desc: 'descending' } as const
const sortIcon = { asc: <ArrowUp />, desc: <ArrowDown /> }

/** Rows of records, each column optionally sortable, with its loading and empty states. */
export function DataTable<TRow extends RowData>({
  columns,
  rows,
  rowId,
  empty,
  caption,
}: DataTableProps<TRow>) {
  const columnDefs = useMemo(() => columns.map(toColumnDef), [columns])
  const alignOf = useMemo(
    () => new Map(columns.map((column) => [column.id, column.align ?? 'start'])),
    [columns],
  )
  const table = useTable({
    features,
    columns: columnDefs,
    data: rows ?? noRows,
    getRowId: rowId,
  })
  const cellClass = (id: string) =>
    cn('px-3 py-2 align-middle', alignOf.get(id) === 'end' ? 'text-right' : 'text-left')

  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <table aria-busy={rows === undefined || undefined} className="w-full caption-bottom text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b bg-muted/50">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                return (
                  <th
                    key={header.id}
                    aria-sort={sorted ? ariaSort[sorted] : undefined}
                    className={cn(
                      cellClass(header.column.id),
                      'h-10 font-medium text-muted-foreground',
                    )}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3.5"
                      >
                        <table.FlexRender header={header} />
                        {sorted ? sortIcon[sorted] : <ArrowUpDown className="opacity-50" />}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody className="[&_tr]:border-b [&_tr:last-child]:border-0">
          {rows === undefined &&
            Array.from({ length: loadingRows }, (_, index) => (
              <tr key={index} aria-hidden>
                {columns.map((column) => (
                  <td key={column.id} className={cellClass(column.id)}>
                    <Skeleton className="h-4 w-full max-w-32" />
                  </td>
                ))}
              </tr>
            ))}
          {rows?.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="p-4">
                {empty}
              </td>
            </tr>
          )}
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-muted/50">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className={cellClass(cell.column.id)}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
