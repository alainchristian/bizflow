/**
 * MVP RBAC is a static role -> permission-set mapping (see
 * `role-permissions.ts`), not a `permissions`/`roles` database table --
 * per CLAUDE.md's own suggestion ("a simpler role-enum-based approach for
 * MVP") and the build order's "your call, document it" framing. There is
 * exactly one fixed role enum (`MembershipRole`, from Step 3) per
 * membership; permissions are derived from that role in code, not stored.
 * This is deliberately not extensible to custom per-organization roles --
 * that's a real feature (blueprint Section labels it Phase 2: "support
 * custom roles Phase 2"), not something to half-build now. When custom
 * roles are actually needed, this file and `role-permissions.ts` are the
 * two places that change; nothing about `PermissionGuard` or
 * `@RequirePermission` would need to.
 */
export enum Permission {
  MEMBERS_INVITE = 'members.invite',
  MEMBERS_REMOVE = 'members.remove',
  MEMBERS_MANAGE_ROLES = 'members.manage_roles',
}
