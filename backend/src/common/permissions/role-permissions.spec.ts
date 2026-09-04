import { describe, expect, it } from 'vitest';
import { MembershipRole } from '../memberships/membership-role.enum.js';
import { Permission } from './permission.enum.js';
import { roleHasPermission } from './role-permissions.js';

describe('roleHasPermission', () => {
  it('grants owners every declared permission', () => {
    for (const permission of Object.values(Permission)) {
      expect(roleHasPermission(MembershipRole.OWNER, permission)).toBe(true);
    }
  });

  it('grants members no management permissions', () => {
    for (const permission of Object.values(Permission)) {
      expect(roleHasPermission(MembershipRole.MEMBER, permission)).toBe(false);
    }
  });

  it('grants admins invite/remove but not role management', () => {
    expect(roleHasPermission(MembershipRole.ADMIN, Permission.MEMBERS_INVITE)).toBe(true);
    expect(roleHasPermission(MembershipRole.ADMIN, Permission.MEMBERS_REMOVE)).toBe(true);
    expect(roleHasPermission(MembershipRole.ADMIN, Permission.MEMBERS_MANAGE_ROLES)).toBe(
      false,
    );
  });
});
