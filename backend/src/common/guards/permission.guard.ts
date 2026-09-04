import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_METADATA_KEY } from '../decorators/require-permission.decorator.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { Permission } from '../permissions/permission.enum.js';
import { roleHasPermission } from '../permissions/role-permissions.js';
import { TenantContextStore } from '../tenant-context/tenant-context.store.js';

/**
 * Enforces `@RequirePermission(...)`. Reads `TenantContextStore.userId`
 * and `.organizationId` -- both already verified by `JwtAuthGuard` and
 * `OrganizationContextGuard` -- and looks up that user's membership *in
 * that organization* to check its role against the required permission.
 *
 * Must run after both of those guards:
 * `@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionGuard)`.
 * If a route has no `@RequirePermission(...)`, this guard is a no-op --
 * it only rejects requests for handlers that declared a requirement.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membershipsService: MembershipsService,
    private readonly tenantContext: TenantContextStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<Permission | undefined>(
      PERMISSION_METADATA_KEY,
      context.getHandler(),
    );
    if (!required) {
      return true;
    }

    const userId = this.tenantContext.userId;
    const organizationId = this.tenantContext.organizationId;
    if (!userId || !organizationId) {
      throw new Error(
        'PermissionGuard requires JwtAuthGuard and OrganizationContextGuard to run first',
      );
    }

    const membership = await this.membershipsService.findMembership(userId, organizationId);
    if (!membership || !roleHasPermission(membership.role, required)) {
      throw new ForbiddenException(`Missing required permission: ${required}`);
    }

    return true;
  }
}
