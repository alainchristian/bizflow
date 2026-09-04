import { Injectable } from '@nestjs/common';
import { MoreThan } from 'typeorm';
import { TenantScopedRepository } from '../../../common/database/tenant-scoped.repository.js';
import { TenantContextStore } from '../../../common/tenant-context/tenant-context.store.js';
import { Invitation } from '../entities/invitation.entity.js';
import { InvitationStatus } from '../invitation-status.enum.js';

@Injectable()
export class InvitationsRepository extends TenantScopedRepository<Invitation> {
  constructor(tenantContext: TenantContextStore) {
    super(Invitation, tenantContext);
  }

  /** Excludes expired-but-still-"pending" rows -- those aren't usable anymore. */
  listPendingForCurrentOrganization(): Promise<Invitation[]> {
    return this.find({
      where: { status: InvitationStatus.PENDING, expiresAt: MoreThan(new Date()) },
    });
  }

  /**
   * Deliberately does NOT filter by expiry -- an owner/admin revoking (or
   * otherwise tidying up) an already-expired invitation should still work.
   */
  findPendingById(id: string): Promise<Invitation | null> {
    return this.findOne({ where: { id, status: InvitationStatus.PENDING } });
  }
}
