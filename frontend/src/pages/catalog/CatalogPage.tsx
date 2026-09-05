import { zodResolver } from '@hookform/resolvers/zod'
import { Badge, Button, Callout, Select, TextField } from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { DataTable } from '../../components/DataTable.tsx'
import {
  createCatalogItem,
  listCatalogItems,
  updateCatalogItem,
  type CatalogItem,
} from '../../features/catalog/api.ts'
import {
  canManageCatalog,
  catalogItemFormSchema,
  fromPriceAmount,
  toPriceAmount,
  type CatalogItemFormValues,
} from '../../features/catalog/schemas.ts'
import { CURRENCY_OPTIONS } from '../../features/organizations/schemas.ts'
import { listMyOrganizations } from '../../features/organizations/api.ts'
import { ApiError } from '../../lib/api.ts'
import { useOrganizationStore } from '../../stores/organization-store.ts'

const EMPTY_FORM: CatalogItemFormValues = {
  name: '',
  description: undefined,
  type: 'product',
  price: '',
  currencyCode: '',
  sku: undefined,
}

export function CatalogPage() {
  const queryClient = useQueryClient()
  const currentOrganizationId = useOrganizationStore((state) => state.currentOrganizationId)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: listMyOrganizations,
  })
  const myRole = organizations?.find((org) => org.id === currentOrganizationId)?.role
  const canManage = canManageCatalog(myRole)

  const { data: items, isLoading } = useQuery({
    queryKey: ['catalog', 'items', currentOrganizationId],
    queryFn: listCatalogItems,
    enabled: currentOrganizationId !== null,
  })

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CatalogItemFormValues>({
    resolver: zodResolver(catalogItemFormSchema),
    defaultValues: EMPTY_FORM,
  })

  useEffect(() => {
    if (editingItem) {
      reset({
        name: editingItem.name,
        description: editingItem.description ?? undefined,
        type: editingItem.type,
        price: fromPriceAmount(editingItem.priceAmount),
        currencyCode: editingItem.currencyCode,
        sku: editingItem.sku ?? undefined,
      })
    } else {
      reset(EMPTY_FORM)
    }
  }, [editingItem, reset])

  const saveMutation = useMutation({
    mutationFn: (values: CatalogItemFormValues) => {
      const input = {
        name: values.name,
        description: values.description,
        type: values.type,
        priceAmount: toPriceAmount(values.price),
        currencyCode: values.currencyCode,
        sku: values.sku,
      }
      return editingItem ? updateCatalogItem(editingItem.id, input) : createCatalogItem(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'items'] })
      setShowForm(false)
      setEditingItem(null)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (item: CatalogItem) => updateCatalogItem(item.id, { isActive: !item.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', 'items'] }),
  })

  const openCreateForm = () => {
    setEditingItem(null)
    setShowForm(true)
  }

  const openEditForm = (item: CatalogItem) => {
    setEditingItem(item)
    setShowForm(true)
  }

  const columns: ColumnDef<CatalogItem, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Type',
      accessorKey: 'type',
      cell: (c) => (
        <Badge color={c.getValue() === 'product' ? 'blue' : 'purple'}>{c.getValue() as string}</Badge>
      ),
    },
    {
      header: 'Price',
      accessorFn: (item) => `${fromPriceAmount(item.priceAmount)} ${item.currencyCode}`,
    },
    { header: 'SKU', accessorKey: 'sku', cell: (c) => c.getValue() ?? '—' },
    {
      header: 'Status',
      accessorKey: 'isActive',
      cell: (c) => (
        <Badge color={c.getValue() ? 'green' : 'gray'}>{c.getValue() ? 'active' : 'inactive'}</Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: CatalogItem } }) => {
              const item = row.original
              return (
                <div className="flex gap-2">
                  <Button variant="soft" size="1" onClick={() => openEditForm(item)}>
                    Edit
                  </Button>
                  <Button
                    variant="soft"
                    color={item.isActive ? 'red' : 'green'}
                    size="1"
                    disabled={toggleActiveMutation.isPending}
                    onClick={() => toggleActiveMutation.mutate(item)}
                  >
                    {item.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              )
            },
          } satisfies ColumnDef<CatalogItem, unknown>,
        ]
      : []),
  ]

  if (currentOrganizationId === null) {
    return <p className="text-gray-600">Create or select an organization first.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Catalog</h1>
        {canManage && (
          <Button
            onClick={() => (showForm ? setShowForm(false) : openCreateForm())}
          >
            {showForm ? 'Cancel' : 'New item'}
          </Button>
        )}
      </div>

      {showForm && canManage && (
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
            <TextField.Root {...register('name')} />
            {errors.name && <span className="text-sm text-red-600">{errors.name.message}</span>}
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Description
            <TextField.Root {...register('description')} />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Type
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select.Root value={field.value} onValueChange={field.onChange}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="product">Product</Select.Item>
                    <Select.Item value="service">Service</Select.Item>
                  </Select.Content>
                </Select.Root>
              )}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Price
            <TextField.Root inputMode="decimal" placeholder="0.00" {...register('price')} />
            {errors.price && <span className="text-sm text-red-600">{errors.price.message}</span>}
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Currency
            <Controller
              control={control}
              name="currencyCode"
              render={({ field }) => (
                <Select.Root value={field.value} onValueChange={field.onChange}>
                  <Select.Trigger placeholder="Select a currency" />
                  <Select.Content>
                    {CURRENCY_OPTIONS.map((option) => (
                      <Select.Item key={option.code} value={option.code}>
                        {option.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              )}
            />
            {errors.currencyCode && (
              <span className="text-sm text-red-600">{errors.currencyCode.message}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            SKU
            <TextField.Root placeholder="Optional, mainly for products" {...register('sku')} />
          </label>

          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending
              ? 'Saving...'
              : editingItem
                ? 'Save changes'
                : 'Create item'}
          </Button>
        </form>
      )}

      <div className="mt-6">
        {isLoading && <p className="text-gray-600">Loading...</p>}
        {items && (
          <DataTable
            columns={columns}
            data={items}
            searchPlaceholder="Search catalog..."
            emptyMessage="No catalog items yet."
          />
        )}
      </div>
    </div>
  )
}
