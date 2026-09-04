import { z } from 'zod'

const optionalEmail = z
  .union([z.string().email('Enter a valid email address'), z.literal('')])
  .optional()
  .transform((value) => (value === '' ? undefined : value))

export const createLeadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  companyName: z.string().optional(),
  email: optionalEmail,
  phone: z.string().optional(),
  source: z.string().optional(),
})

export type CreateLeadValues = z.infer<typeof createLeadSchema>

export const addContactSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: optionalEmail,
  phone: z.string().optional(),
})

export type AddContactValues = z.infer<typeof addContactSchema>

/**
 * Mirrors backend/src/common/permissions/role-permissions.ts -- a UI
 * convenience (hide the Convert button from a Member) only. The backend's
 * PermissionGuard is the real enforcement.
 */
export function canConvertLead(role: 'owner' | 'admin' | 'member' | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

