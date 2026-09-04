import { Button, Table, TextField } from '@radix-ui/themes'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'

/**
 * A thin, headless wrapper around TanStack Table -- it owns sorting,
 * global-text filtering, and pagination STATE and wiring, but every
 * column decides its own rendering via `ColumnDef.cell` (through
 * `flexRender`, TanStack's standard escape hatch). That's deliberate:
 * this component is meant to be reused wherever a list-with-a-table
 * screen is needed (catalog, quotations, invoicing, ...), and those
 * later screens need line-item-style rows -- editable numeric cells,
 * per-row remove buttons, footer subtotal/tax/total rows -- that a
 * purely presentational, read-only-cell table couldn't support without
 * a rewrite. Nothing here assumes a cell renders as plain text.
 *
 * What this does NOT do, on purpose, for a first version built for a
 * read-only browsing screen (leads/customers lists): inline editing,
 * row add/remove controls, or a footer/aggregation row. See the
 * CLAUDE.md build-order note for Step 5 on why those are deferred
 * rather than spec'd in now, and what to reconsider when quotations/
 * invoicing actually need them.
 */
export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  searchPlaceholder?: string
  pageSize?: number
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  onRowClick,
  emptyMessage = 'No results.',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  return (
    <div>
      <TextField.Root
        className="max-w-xs"
        placeholder={searchPlaceholder}
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
      />

      <div className="mt-3 overflow-x-auto">
        <Table.Root>
          <Table.Header>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Row key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.ColumnHeaderCell key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="flex items-center gap-1 font-medium"
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? ''}
                      </button>
                    )}
                  </Table.ColumnHeaderCell>
                ))}
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body>
            {table.getRowModel().rows.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={columns.length} className="text-gray-600">
                  {emptyMessage}
                </Table.Cell>
              </Table.Row>
            )}
            {table.getRowModel().rows.map((row) => (
              <Table.Row
                key={row.id}
                className={onRowClick ? 'cursor-pointer' : undefined}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <Table.Cell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </div>

      {table.getPageCount() > 1 && (
        <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
          <Button
            variant="soft"
            color="gray"
            size="1"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="soft"
            color="gray"
            size="1"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
