import { z } from 'zod'
import { optionalText } from '../../lib/zod-helpers.ts'

export const catalogItemFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: optionalText(),
  type: z.enum(['product', 'service'], { message: 'Select a type' }),
  // Entered as a decimal major-unit string (e.g. "150.00") for a readable
  // form field; converted to integer minor units at the API boundary --
  // the backend, per CLAUDE.md, never stores money as a float.
  price: z
    .string()
    .min(1, 'Price is required')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, {
      message: 'Enter a valid, non-negative price',
    }),
  currencyCode: z.string().length(3, 'Select a currency'),
  sku: optionalText(),
})

export type CatalogItemFormValues = z.infer<typeof catalogItemFormSchema>

export function toPriceAmount(price: string): number {
  return Math.round(Number(price) * 100)
}

export function fromPriceAmount(priceAmount: number): string {
  return (priceAmount / 100).toFixed(2)
}

/**
 * Mirrors backend/src/common/permissions/role-permissions.ts, purely to
 * decide what to show in the UI -- the backend's PermissionGuard is the
 * real enforcement (a Member who forged a request past this UI still gets
 * a 403).
 */
export function canManageCatalog(role: 'owner' | 'admin' | 'member' | undefined): boolean {
  return role === 'owner' || role === 'admin'
}
