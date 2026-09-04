import { Injectable } from '@nestjs/common';
import { TenantContextStore } from '../tenant-context/tenant-context.store.js';
import { Membership } from './entities/membership.entity.js';
import { MembershipRole } from './membership-role.enum.js';

/**
 * Membership rows are looked up by `userId`, not `organizationId` -- a user
 * discovering or switching between their own organizations is inherently a
 * cross-tenant query, so this deliberately does not extend
 * `TenantScopedRepository`. It is instead protected by its own RLS policy
 * keyed on `app.current_user_id` (set by `JwtAuthGuard`), so a query here
 * can never return another user's membership rows even if it forgot a
 * `userId` filter.
 */
@Injectable()
export class MembershipsService {
  constructor(private readonly tenantContext: TenantContextStore) {}

  private get repository() {
    return this.tenantContext.getRepository(Membership);
  }

  findMembership(userId: string, organizationId: string): Promise<Membership | null> {
    return this.repository.findOne({ where: { userId, organizationId } });
  }

  listForUser(userId: string): Promise<Membership[]> {
    return this.repository.find({ where: { userId } });
  }

  createMembership(
    userId: string,
    organizationId: string,
    role: MembershipRole,
  ): Promise<Membership> {
    const membership = this.repository.create({ userId, organizationId, role });
    return this.repository.save(membership);
  }
}
