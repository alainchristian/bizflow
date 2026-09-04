import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MembershipsService } from '../memberships/memberships.service.js';
import { TenantContextStore } from '../tenant-context/tenant-context.store.js';
import { AuthenticatedRequest } from '../types/authenticated-request.type.js';

const ORGANIZATION_HEADER = 'x-organization-id';

/**
 * Resolves which organization the current (already-authenticated) request
 * is operating in, and rejects the request if it can't establish one the
 * user actually belongs to.
 *
 * A client may declare intent via the `X-Organization-Id` header, but that
 * header is never trusted on its own -- it is only a *candidate*, checked
 * against the user's real membership rows before `TenantContextStore` (and
 * therefore every repository and RLS policy downstream) ever sees it. A
 * request with no header defaults to the user's only organization, if they
 * have exactly one; anything else is rejected rather than guessed at.
 *
 * Must run after `JwtAuthGuard` (it needs `request.user`), e.g.
 * `@UseGuards(JwtAuthGuard, OrganizationContextGuard)`.
 */
@Injectable()
export class OrganizationContextGuard implements CanActivate {
  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly tenantContext: TenantContextStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException(
        'Authentication is required before an organization can be resolved',
      );
    }

    const requestedOrganizationId = this.extractRequestedOrganizationId(request);
    const organizationId = requestedOrganizationId
      ? await this.resolveRequested(userId, requestedOrganizationId)
      : await this.resolveDefault(userId);

    await this.tenantContext.setOrganizationId(organizationId);
    return true;
  }

  private async resolveRequested(
    userId: string,
    organizationId: string,
  ): Promise<string> {
    const membership = await this.membershipsService.findMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization');
    }
    return organizationId;
  }

  private async resolveDefault(userId: string): Promise<string> {
    const memberships = await this.membershipsService.listForUser(userId);
    if (memberships.length === 0) {
      throw new ForbiddenException('You are not a member of any organization yet');
    }
    if (memberships.length > 1) {
      throw new BadRequestException(
        'You belong to multiple organizations; specify one via the X-Organization-Id header',
      );
    }
    return memberships[0].organizationId;
  }

  private extractRequestedOrganizationId(
    request: AuthenticatedRequest,
  ): string | undefined {
    const header = request.headers[ORGANIZATION_HEADER];
    return Array.isArray(header) ? header[0] : header;
  }
}
