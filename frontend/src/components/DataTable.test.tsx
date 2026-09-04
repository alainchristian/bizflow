import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnDef } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test-utils.tsx'
import { DataTable } from './DataTable.tsx'

interface Row {
  id: string
  name: string
  age: number
}

const columns: ColumnDef<Row, unknown>[] = [
  { header: 'Name', accessorKey: 'name' },
  { header: 'Age', accessorKey: 'age' },
]

const data: Row[] = [
  { id: '1', name: 'Charlie', age: 40 },
  { id: '2', name: 'Alice', age: 30 },
  { id: '3', name: 'Bob', age: 20 },
]

describe('DataTable', () => {
  it('renders every row by default', () => {
    renderWithProviders(<DataTable columns={columns} data={data} />)

    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows the empty message when there is no data', () => {
    renderWithProviders(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />)

    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('filters rows via the search box', async () => {
    renderWithProviders(<DataTable columns={columns} data={data} />)

    await userEvent.type(screen.getByPlaceholderText('Search...'), 'ali')

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
  })

  it('sorts a column when its header is clicked', async () => {
    renderWithProviders(<DataTable columns={columns} data={data} />)

    await userEvent.click(screen.getByRole('button', { name: /name/i }))

    const rows = screen.getAllByRole('row').slice(1) // drop the header row
    expect(within(rows[0]).getByText('Alice')).toBeInTheDocument()
  })

  it('paginates when there are more rows than the page size', async () => {
    const manyRows: Row[] = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      name: `Row ${i}`,
      age: i,
    }))

    renderWithProviders(<DataTable columns={columns} data={manyRows} pageSize={10} />)

    expect(screen.getByText('Row 0')).toBeInTheDocument()
    expect(screen.queryByText('Row 10')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('Row 10')).toBeInTheDocument()
    expect(screen.queryByText('Row 0')).not.toBeInTheDocument()
  })

  it('calls onRowClick with the row data', async () => {
    let clicked: Row | undefined
    renderWithProviders(
      <DataTable columns={columns} data={data} onRowClick={(row) => (clicked = row)} />,
    )

    await userEvent.click(screen.getByText('Alice'))

    expect(clicked).toMatchObject({ name: 'Alice' })
  })
})
