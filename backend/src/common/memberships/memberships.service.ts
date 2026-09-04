import { Injectable } from '@nestjs/common';
import { TenantContextStore } from '../tenant-context/tenant-context.store.js';
import { Membership } from './entities/membership.entity.js';
import { MembershipRole } from './membership-role.enum.js';

/**
 * Membership rows are looked up by `userId`, not `organizationId` -- a user
 * discovering or switching between their own organizations is inherently a
 * cross-tenant query, so this deliberately does not extend
 * `TenantScopedRepository`. It is instead protected by its own RLS policy
 * keyed on `app.current_user_id` (set by `JwtAuthGuard`) OR
 * `app.current_org_id` (set by `OrganizationContextGuard`) -- see the
 * migration -- so a query here can never return a row outside those two
 * cases even if it forgot a filter.
 *
 * `listForOrganization`/`findInOrganization`/`updateRole`/`remove` are the
 * "team management" half added in Step 4; they rely on the
 * `app.current_org_id`-scoped branch of that policy, so callers must run
 * behind `OrganizationContextGuard` (not just `JwtAuthGuard`).
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

  listForOrganization(organizationId: string): Promise<Membership[]> {
    return this.repository.find({ where: { organizationId } });
  }

  countOwners(organizationId: string): Promise<number> {
    return this.repository.count({
      where: { organizationId, role: MembershipRole.OWNER },
    });
  }

  /** Scoped by organizationId so a membership id from another org 404s rather than leaking. */
  findInOrganization(organizationId: string, membershipId: string): Promise<Membership | null> {
    return this.repository.findOne({ where: { id: membershipId, organizationId } });
  }

  async updateRole(membership: Membership, role: MembershipRole): Promise<Membership> {
    membership.role = role;
    return this.repository.save(membership);
  }

  async remove(membership: Membership): Promise<void> {
    await this.repository.remove(membership);
  }
}
