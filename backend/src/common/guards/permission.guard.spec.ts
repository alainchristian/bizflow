import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipRole } from '../memberships/membership-role.enum.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { Permission } from '../permissions/permission.enum.js';
import { TenantContextStore } from '../tenant-context/tenant-context.store.js';
import { PermissionGuard } from './permission.guard.js';

function buildContext(): ExecutionContext {
  return {
    getHandler: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  let reflector: { get: ReturnType<typeof vi.fn> };
  let membershipsService: { findMembership: ReturnType<typeof vi.fn> };
  let tenantContext: { userId: string | null; organizationId: string | null };
  let guard: PermissionGuard;

  beforeEach(() => {
    reflector = { get: vi.fn() };
    membershipsService = { findMembership: vi.fn() };
    tenantContext = { userId: 'user-1', organizationId: 'org-1' };
    guard = new PermissionGuard(
      reflector as unknown as Reflector,
      membershipsService as unknown as MembershipsService,
      tenantContext as unknown as TenantContextStore,
    );
  });

  it('allows the request through when the route requires no permission', async () => {
    reflector.get.mockReturnValue(undefined);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(membershipsService.findMembership).not.toHaveBeenCalled();
  });

  it('allows a role that has the required permission', async () => {
    reflector.get.mockReturnValue(Permission.ORGANIZATIONS_MEMBERS_INVITE);
    membershipsService.findMembership.mockResolvedValue({ role: MembershipRole.ADMIN });

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it("rejects a role that doesn't have the required permission", async () => {
    reflector.get.mockReturnValue(Permission.ORGANIZATIONS_MEMBERS_MANAGE_ROLES);
    membershipsService.findMembership.mockResolvedValue({ role: MembershipRole.ADMIN });

    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      'Missing required permission: organizations.members.manage_roles',
    );
  });

  it('rejects when the caller has no membership in the organization at all', async () => {
    reflector.get.mockReturnValue(Permission.ORGANIZATIONS_MEMBERS_INVITE);
    membershipsService.findMembership.mockResolvedValue(null);

    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      'Missing required permission',
    );
  });

  it('throws if userId/organizationId are not already set on the context', async () => {
    reflector.get.mockReturnValue(Permission.ORGANIZATIONS_MEMBERS_INVITE);
    tenantContext.organizationId = null;

    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      'requires JwtAuthGuard and OrganizationContextGuard to run first',
    );
  });
});
