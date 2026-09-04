import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Callout, Select, TextField } from '@radix-ui/themes'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { createOrganization } from '../../features/organizations/api.ts'
import {
  COUNTRY_OPTIONS,
  createOrganizationSchema,
  CURRENCY_OPTIONS,
  type CreateOrganizationValues,
} from '../../features/organizations/schemas.ts'
import { ApiError } from '../../lib/api.ts'
import { useOrganizationStore } from '../../stores/organization-store.ts'

export function CreateOrganizationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setCurrentOrganizationId = useOrganizationStore(
    (state) => state.setCurrentOrganizationId,
  )

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: '', countryCode: '', baseCurrency: '' },
  })

  const mutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: async (organization) => {
      setCurrentOrganizationId(organization.id)
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      navigate('/account')
    },
  })

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-gray-900">Create your organization</h1>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {mutation.isError && (
          <Callout.Root color="red">
            <Callout.Text>
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : 'Something went wrong. Please try again.'}
            </Callout.Text>
          </Callout.Root>
        )}

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Organization name
          <TextField.Root type="text" {...register('name')} />
          {errors.name && (
            <span className="text-sm text-red-600">{errors.name.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Country
          <Controller
            control={control}
            name="countryCode"
            render={({ field }) => (
              <Select.Root value={field.value} onValueChange={field.onChange}>
                <Select.Trigger placeholder="Select a country" />
                <Select.Content>
                  {COUNTRY_OPTIONS.map((option) => (
                    <Select.Item key={option.code} value={option.code}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            )}
          />
          {errors.countryCode && (
            <span className="text-sm text-red-600">{errors.countryCode.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Currency
          <Controller
            control={control}
            name="baseCurrency"
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
          {errors.baseCurrency && (
            <span className="text-sm text-red-600">{errors.baseCurrency.message}</span>
          )}
        </label>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating...' : 'Create organization'}
        </Button>
      </form>
    </div>
  )
}
