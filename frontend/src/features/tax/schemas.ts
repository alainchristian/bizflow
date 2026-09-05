import { z } from 'zod'

export const taxRuleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  // Entered as a decimal percentage string (e.g. "7.25") for a readable
  // form field; converted to integer basis points at the API boundary --
  // see backend/src/sales/tax-calculation.service.ts for why rates are
  // never stored or computed as floats.
  rate: z
    .string()
    .min(1, 'Rate is required')
    .refine(
      (value) => !Number.isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 100,
      { message: 'Enter a rate between 0 and 100' },
    ),
  isInclusive: z.boolean(),
})

export type TaxRuleFormValues = z.infer<typeof taxRuleFormSchema>

export function toRateBasisPoints(rate: string): number {
  return Math.round(Number(rate) * 100)
}

export function fromRateBasisPoints(rateBasisPoints: number): string {
  return (rateBasisPoints / 100).toFixed(2)
}

/**
 * Mirrors backend/src/common/permissions/role-permissions.ts, purely to
 * decide what to show in the UI -- the backend's PermissionGuard is the
 * real enforcement (a Member who forged a request past this UI still gets
 * a 403, on view as well as create/manage for tax rules specifically).
 */
export function canManageTaxRules(role: 'owner' | 'admin' | 'member' | undefined): boolean {
  return role === 'owner' || role === 'admin'
}
