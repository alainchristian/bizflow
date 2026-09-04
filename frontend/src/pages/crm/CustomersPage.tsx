import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '../../components/DataTable.tsx'
import { listCustomers, type Customer } from '../../features/crm/api.ts'
import { useOrganizationStore } from '../../stores/organization-store.ts'

const columns: ColumnDef<Customer, unknown>[] = [
  { header: 'Name', accessorKey: 'name' },
  { header: 'Email', accessorKey: 'email', cell: (c) => c.getValue() ?? '—' },
  { header: 'Phone', accessorKey: 'phone', cell: (c) => c.getValue() ?? '—' },
]

export function CustomersPage() {
  const navigate = useNavigate()
  const currentOrganizationId = useOrganizationStore((state) => state.currentOrganizationId)

  const { data: customers, isLoading } = useQuery({
    queryKey: ['crm', 'customers', currentOrganizationId],
    queryFn: listCustomers,
    enabled: currentOrganizationId !== null,
  })

  if (currentOrganizationId === null) {
    return <p className="text-gray-600">Create or select an organization first.</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>

      <div className="mt-6">
        {isLoading && <p className="text-gray-600">Loading...</p>}
        {customers && (
          <DataTable
            columns={columns}
            data={customers}
            searchPlaceholder="Search customers..."
            emptyMessage="No customers yet."
            onRowClick={(customer) => navigate(`/crm/customers/${customer.id}`)}
          />
        )}
      </div>
    </div>
  )
}
