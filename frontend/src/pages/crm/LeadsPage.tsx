import { zodResolver } from '@hookform/resolvers/zod'
import { Badge, Button, Callout, TextField } from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '../../components/DataTable.tsx'
import { convertLead, createLead, listLeads, type Lead } from '../../features/crm/api.ts'
import { canConvertLead, createLeadSchema, type CreateLeadValues } from '../../features/crm/schemas.ts'
import { listMyOrganizations } from '../../features/organizations/api.ts'
import { ApiError } from '../../lib/api.ts'
import { useOrganizationStore } from '../../stores/organization-store.ts'

const STATUS_COLOR: Record<Lead['status'], 'blue' | 'amber' | 'green' | 'gray' | 'red'> = {
  new: 'blue',
  contacted: 'amber',
  qualified: 'green',
  converted: 'gray',
  lost: 'red',
}

export function LeadsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentOrganizationId = useOrganizationStore((state) => state.currentOrganizationId)
  const [showForm, setShowForm] = useState(false)

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: listMyOrganizations,
  })
  const myRole = organizations?.find((org) => org.id === currentOrganizationId)?.role

  const { data: leads, isLoading } = useQuery({
    queryKey: ['crm', 'leads', currentOrganizationId],
    queryFn: listLeads,
    enabled: currentOrganizationId !== null,
  })

  const createMutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] })
      reset()
      setShowForm(false)
    },
  })

  const convertMutation = useMutation({
    mutationFn: convertLead,
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'leads'] })
      navigate(`/crm/customers/${customer.id}`)
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateLeadValues>({ resolver: zodResolver(createLeadSchema) })

  const columns: ColumnDef<Lead, unknown>[] = [
    { header: 'Name', accessorKey: 'fullName' },
    { header: 'Company', accessorKey: 'companyName', cell: (c) => c.getValue() ?? '—' },
    { header: 'Email', accessorKey: 'email', cell: (c) => c.getValue() ?? '—' },
    { header: 'Source', accessorKey: 'source', cell: (c) => c.getValue() ?? '—' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (c) => {
        const status = c.getValue() as Lead['status']
        return <Badge color={STATUS_COLOR[status]}>{status}</Badge>
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const lead = row.original
        if (lead.status === 'converted') {
          return (
            <Button
              variant="soft"
              size="1"
              onClick={() => navigate(`/crm/customers/${lead.convertedCustomerId}`)}
            >
              View customer
            </Button>
          )
        }
        if (!canConvertLead(myRole)) return null
        return (
          <Button
            variant="soft"
            size="1"
            disabled={convertMutation.isPending}
            onClick={() => convertMutation.mutate(lead.id)}
          >
            Convert
          </Button>
        )
      },
    },
  ]

  if (currentOrganizationId === null) {
    return <p className="text-gray-600">Create or select an organization first.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'New lead'}
        </Button>
      </div>

      {showForm && (
        <form
          className="mt-4 flex max-w-md flex-col gap-4 rounded border border-gray-200 bg-white p-4"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          {createMutation.isError && (
            <Callout.Root color="red">
              <Callout.Text>
                {createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : 'Something went wrong. Please try again.'}
              </Callout.Text>
            </Callout.Root>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Full name
            <TextField.Root {...register('fullName')} />
            {errors.fullName && (
              <span className="text-sm text-red-600">{errors.fullName.message}</span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Company
            <TextField.Root {...register('companyName')} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Email
            <TextField.Root type="email" {...register('email')} />
            {errors.email && (
              <span className="text-sm text-red-600">{errors.email.message}</span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Phone
            <TextField.Root {...register('phone')} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Source
            <TextField.Root placeholder="e.g. referral, website" {...register('source')} />
          </label>

          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create lead'}
          </Button>
        </form>
      )}

      <div className="mt-6">
        {isLoading && <p className="text-gray-600">Loading...</p>}
        {leads && (
          <DataTable
            columns={columns}
            data={leads}
            searchPlaceholder="Search leads..."
            emptyMessage="No leads yet."
          />
        )}
      </div>
    </div>
  )
}
