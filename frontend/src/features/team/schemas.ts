import { z } from 'zod'

export const inviteMemberSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  role: z.enum(['admin', 'member'], { message: 'Select a role' }),
})

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>

/**
 * Mirrors backend/src/common/permissions/role-permissions.ts, purely to
 * decide what to show in the UI (hide the invite form/role controls from
 * a Member). This is a convenience, not a security boundary -- the
 * backend's PermissionGuard is what actually enforces this; a user who
 * forged a request past this UI would still get a 403 from the API.
 */
export function canManageTeam(role: 'owner' | 'admin' | 'member' | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageRoles(role: 'owner' | 'admin' | 'member' | undefined): boolean {
  return role === 'owner'
}
