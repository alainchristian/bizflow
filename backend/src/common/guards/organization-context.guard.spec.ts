import { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipRole } from '../memberships/membership-role.enum.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { TenantContextStore } from '../tenant-context/tenant-context.store.js';
import { OrganizationContextGuard } from './organization-context.guard.js';

function buildContext(headers: Record<string, string>, userId?: string): ExecutionContext {
  const request = { headers, user: userId ? { sub: userId, email: 'x@example.com' } : undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('OrganizationContextGuard', () => {
  let membershipsService: {
    findMembership: ReturnType<typeof vi.fn>;
    listForUser: ReturnType<typeof vi.fn>;
  };
  let tenantContext: { setOrganizationId: ReturnType<typeof vi.fn> };
  let guard: OrganizationContextGuard;

  beforeEach(() => {
    membershipsService = { findMembership: vi.fn(), listForUser: vi.fn() };
    tenantContext = { setOrganizationId: vi.fn() };
    guard = new OrganizationContextGuard(
      membershipsService as unknown as MembershipsService,
      tenantContext as unknown as TenantContextStore,
    );
  });

  it('rejects a request with no authenticated user', async () => {
    await expect(guard.canActivate(buildContext({}))).rejects.toThrow(
      'Authentication is required',
    );
  });

  describe('with an X-Organization-Id header', () => {
    it('sets the org context when the user has a membership there', async () => {
      membershipsService.findMembership.mockResolvedValue({
        organizationId: 'org-1',
        role: MembershipRole.OWNER,
      });

      const result = await guard.canActivate(
        buildContext({ 'x-organization-id': 'org-1' }, 'user-1'),
      );

      expect(result).toBe(true);
      expect(membershipsService.findMembership).toHaveBeenCalledWith('user-1', 'org-1');
      expect(tenantContext.setOrganizationId).toHaveBeenCalledWith('org-1');
    });

    it("rejects the request when the header names an org the user doesn't belong to", async () => {
      membershipsService.findMembership.mockResolvedValue(null);

      await expect(
        guard.canActivate(buildContext({ 'x-organization-id': 'org-2' }, 'user-1')),
      ).rejects.toThrow('You do not have access to this organization');
      expect(tenantContext.setOrganizationId).not.toHaveBeenCalled();
    });
  });

  describe('with no header', () => {
    it('defaults to the single organization the user belongs to', async () => {
      membershipsService.listForUser.mockResolvedValue([
        { organizationId: 'org-1', role: MembershipRole.OWNER },
      ]);

      const result = await guard.canActivate(buildContext({}, 'user-1'));

      expect(result).toBe(true);
      expect(tenantContext.setOrganizationId).toHaveBeenCalledWith('org-1');
    });

    it('rejects a user with no organization membership', async () => {
      membershipsService.listForUser.mockResolvedValue([]);

      await expect(guard.canActivate(buildContext({}, 'user-1'))).rejects.toThrow(
        'You are not a member of any organization yet',
      );
    });

    it('asks for a header when the user belongs to multiple organizations', async () => {
      membershipsService.listForUser.mockResolvedValue([
        { organizationId: 'org-1', role: MembershipRole.OWNER },
        { organizationId: 'org-2', role: MembershipRole.MEMBER },
      ]);

      await expect(guard.canActivate(buildContext({}, 'user-1'))).rejects.toThrow(
        'specify one via the X-Organization-Id header',
      );
      expect(tenantContext.setOrganizationId).not.toHaveBeenCalled();
    });
  });
});
