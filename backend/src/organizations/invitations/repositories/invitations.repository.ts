import { Injectable } from '@nestjs/common';
import { TenantScopedRepository } from '../../../common/database/tenant-scoped.repository.js';
import { TenantContextStore } from '../../../common/tenant-context/tenant-context.store.js';
import { Invitation } from '../entities/invitation.entity.js';
import { InvitationStatus } from '../invitation-status.enum.js';

@Injectable()
export class InvitationsRepository extends TenantScopedRepository<Invitation> {
  constructor(tenantContext: TenantContextStore) {
    super(Invitation, tenantContext);
  }

  listPendingForCurrentOrganization(): Promise<Invitation[]> {
    return this.find({ where: { status: InvitationStatus.PENDING } });
  }

  findPendingById(id: string): Promise<Invitation | null> {
    return this.findOne({ where: { id, status: InvitationStatus.PENDING } });
  }
}
