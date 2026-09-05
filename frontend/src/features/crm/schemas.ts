import { z } from 'zod'
import { optionalEmail, optionalText } from '../../lib/zod-helpers.ts'

export const createLeadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  companyName: optionalText(),
  email: optionalEmail(),
  phone: optionalText(),
  source: optionalText(),
})

export type CreateLeadValues = z.infer<typeof createLeadSchema>

export const addContactSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: optionalEmail(),
  phone: optionalText(),
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

