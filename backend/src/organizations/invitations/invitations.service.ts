import { Injectable } from '@nestjs/common';
import { MembershipRole } from '../../common/memberships/membership-role.enum.js';
import { TenantContextStore } from '../../common/tenant-context/tenant-context.store.js';
import { Invitation } from './entities/invitation.entity.js';
import { InvitationStatus } from './invitation-status.enum.js';
import { InvitationsRepository } from './repositories/invitations.repository.js';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly tenantContext: TenantContextStore,
  ) {}

  createInvitation(
    email: string,
    role: MembershipRole,
    invitedByUserId: string,
  ): Promise<Invitation> {
    return this.invitationsRepository.create({ email, role, invitedByUserId });
  }

  listPendingForCurrentOrganization(): Promise<Invitation[]> {
    return this.invitationsRepository.listPendingForCurrentOrganization();
  }

  async revoke(id: string): Promise<Invitation | null> {
    const invitation = await this.invitationsRepository.findPendingById(id);
    if (!invitation) {
      return null;
    }
    invitation.status = InvitationStatus.REVOKED;
    return this.invitationsRepository.save(invitation);
  }

  /**
   * The accepting user has no organization context yet -- that's exactly
   * what accepting grants them -- so this deliberately bypasses
   * `InvitationsRepository` (whose `organizationId` getter would just
   * throw, since `OrganizationContextGuard` never runs on the accept
   * route) and reads through `TenantContextStore` directly. The
   * `invitations` RLS policy's `email = ...` branch (see the migration) is
   * what makes this safe rather than "no scoping at all": Postgres itself
   * will only return this row if `email` matches the authenticated
   * caller's own email, regardless of what id they pass.
   */
  findPendingByIdForEmail(id: string, email: string): Promise<Invitation | null> {
    return this.tenantContext.getRepository(Invitation).findOne({
      where: { id, email, status: InvitationStatus.PENDING },
    });
  }

  async markAccepted(invitation: Invitation): Promise<void> {
    invitation.status = InvitationStatus.ACCEPTED;
    await this.tenantContext.getRepository(Invitation).save(invitation);
  }
}
