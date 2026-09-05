import { zodResolver } from '@hookform/resolvers/zod'
import { Badge, Button, Callout, Checkbox, TextField } from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { DataTable } from '../../components/DataTable.tsx'
import { listMyOrganizations } from '../../features/organizations/api.ts'
import { createTaxRule, listTaxRules, updateTaxRule, type TaxRule } from '../../features/tax/api.ts'
import {
  canManageTaxRules,
  fromRateBasisPoints,
  taxRuleFormSchema,
  toRateBasisPoints,
  type TaxRuleFormValues,
} from '../../features/tax/schemas.ts'
import { ApiError } from '../../lib/api.ts'
import { useOrganizationStore } from '../../stores/organization-store.ts'

const EMPTY_FORM: TaxRuleFormValues = { name: '', rate: '', isInclusive: false }

export function TaxRulesPage() {
  const queryClient = useQueryClient()
  const currentOrganizationId = useOrganizationStore((state) => state.currentOrganizationId)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null)

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: listMyOrganizations,
  })
  const myRole = organizations?.find((org) => org.id === currentOrganizationId)?.role
  const canManage = canManageTaxRules(myRole)

  const { data: rules, isLoading } = useQuery({
    queryKey: ['tax', 'rules', currentOrganizationId],
    queryFn: listTaxRules,
    enabled: currentOrganizationId !== null && canManage,
  })

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaxRuleFormValues>({
    resolver: zodResolver(taxRuleFormSchema),
    defaultValues: EMPTY_FORM,
  })

  useEffect(() => {
    if (editingRule) {
      reset({
        name: editingRule.name,
        rate: fromRateBasisPoints(editingRule.rateBasisPoints),
        isInclusive: editingRule.isInclusive,
      })
    } else {
      reset(EMPTY_FORM)
    }
  }, [editingRule, reset])

  const saveMutation = useMutation({
    mutationFn: (values: TaxRuleFormValues) => {
      const input = {
        name: values.name,
        rateBasisPoints: toRateBasisPoints(values.rate),
        isInclusive: values.isInclusive,
      }
      return editingRule ? updateTaxRule(editingRule.id, input) : createTaxRule(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax', 'rules'] })
      setShowForm(false)
      setEditingRule(null)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (rule: TaxRule) => updateTaxRule(rule.id, { isActive: !rule.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax', 'rules'] }),
  })

  const openCreateForm = () => {
    setEditingRule(null)
    setShowForm(true)
  }

  const openEditForm = (rule: TaxRule) => {
    setEditingRule(rule)
    setShowForm(true)
  }

  const columns: ColumnDef<TaxRule, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Rate',
      accessorFn: (rule) => `${fromRateBasisPoints(rule.rateBasisPoints)}%`,
    },
    {
      header: 'Pricing',
      accessorKey: 'isInclusive',
      cell: (c) => (c.getValue() ? 'Inclusive' : 'Exclusive'),
    },
    {
      header: 'Status',
      accessorKey: 'isActive',
      cell: (c) => (
        <Badge color={c.getValue() ? 'green' : 'gray'}>{c.getValue() ? 'active' : 'inactive'}</Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const rule = row.original
        return (
          <div className="flex gap-2">
            <Button variant="soft" size="1" onClick={() => openEditForm(rule)}>
              Edit
            </Button>
            <Button
              variant="soft"
              color={rule.isActive ? 'red' : 'green'}
              size="1"
              disabled={toggleActiveMutation.isPending}
              onClick={() => toggleActiveMutation.mutate(rule)}
            >
              {rule.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        )
      },
    },
  ]

  if (currentOrganizationId === null) {
    return <p className="text-gray-600">Create or select an organization first.</p>
  }

  if (!canManage) {
    return <p className="text-gray-600">You don't have access to tax settings.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Tax settings</h1>
        <Button onClick={() => (showForm ? setShowForm(false) : openCreateForm())}>
          {showForm ? 'Cancel' : 'New tax rule'}
        </Button>
      </div>

      {showForm && (
        <form
          className="mt-4 flex max-w-md flex-col gap-4 rounded border border-gray-200 bg-white p-4"
          onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        >
          {saveMutation.isError && (
            <Callout.Root color="red">
              <Callout.Text>
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : 'Something went wrong. Please try again.'}
              </Callout.Text>
            </Callout.Root>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Name
            <TextField.Root placeholder="e.g. VAT, Sales Tax" {...register('name')} />
            {errors.name && <span className="text-sm text-red-600">{errors.name.message}</span>}
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Rate (%)
            <TextField.Root inputMode="decimal" placeholder="0.00" {...register('rate')} />
            {errors.rate && <span className="text-sm text-red-600">{errors.rate.message}</span>}
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Controller
              control={control}
              name="isInclusive"
              render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
              )}
            />
            Prices already include this tax
          </label>

          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : editingRule ? 'Save changes' : 'Create tax rule'}
          </Button>
        </form>
      )}

      <div className="mt-6">
        {isLoading && <p className="text-gray-600">Loading...</p>}
        {rules && (
          <DataTable
            columns={columns}
            data={rules}
            searchPlaceholder="Search tax rules..."
            emptyMessage="No tax rules yet."
          />
        )}
      </div>
    </div>
  )
}
