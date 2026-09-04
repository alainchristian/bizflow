import { MembershipRole } from '../memberships/membership-role.enum.js';
import { Permission } from './permission.enum.js';

const ROLE_PERMISSIONS: Record<MembershipRole, ReadonlySet<Permission>> = {
  [MembershipRole.OWNER]: new Set(Object.values(Permission)),
  [MembershipRole.ADMIN]: new Set([Permission.MEMBERS_INVITE, Permission.MEMBERS_REMOVE]),
  [MembershipRole.MEMBER]: new Set(),
};

export function roleHasPermission(role: MembershipRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
