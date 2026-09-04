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

  it('grants members no organization-management permissions', () => {
    expect(roleHasPermission(MembershipRole.MEMBER, Permission.ORGANIZATIONS_MEMBERS_INVITE)).toBe(
      false,
    );
    expect(roleHasPermission(MembershipRole.MEMBER, Permission.ORGANIZATIONS_MEMBERS_REMOVE)).toBe(
      false,
    );
    expect(
      roleHasPermission(MembershipRole.MEMBER, Permission.ORGANIZATIONS_MEMBERS_MANAGE_ROLES),
    ).toBe(false);
  });

  it('grants members everyday CRM permissions but not converting a lead', () => {
    expect(roleHasPermission(MembershipRole.MEMBER, Permission.CRM_LEADS_VIEW)).toBe(true);
    expect(roleHasPermission(MembershipRole.MEMBER, Permission.CRM_LEADS_CREATE)).toBe(true);
    expect(roleHasPermission(MembershipRole.MEMBER, Permission.CRM_CUSTOMERS_VIEW)).toBe(true);
    expect(roleHasPermission(MembershipRole.MEMBER, Permission.CRM_CUSTOMERS_MANAGE)).toBe(true);
    expect(roleHasPermission(MembershipRole.MEMBER, Permission.CRM_LEADS_CONVERT)).toBe(false);
  });

  it('grants admins invite/remove but not role management', () => {
    expect(
      roleHasPermission(MembershipRole.ADMIN, Permission.ORGANIZATIONS_MEMBERS_INVITE),
    ).toBe(true);
    expect(
      roleHasPermission(MembershipRole.ADMIN, Permission.ORGANIZATIONS_MEMBERS_REMOVE),
    ).toBe(true);
    expect(
      roleHasPermission(MembershipRole.ADMIN, Permission.ORGANIZATIONS_MEMBERS_MANAGE_ROLES),
    ).toBe(false);
  });

  it('grants admins full CRM access, including converting a lead', () => {
    expect(roleHasPermission(MembershipRole.ADMIN, Permission.CRM_LEADS_CONVERT)).toBe(true);
  });
});
