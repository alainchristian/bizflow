import { Injectable } from '@nestjs/common';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository.js';
import { TenantContextStore } from '../../common/tenant-context/tenant-context.store.js';
import { Lead } from '../entities/lead.entity.js';

@Injectable()
export class LeadsRepository extends TenantScopedRepository<Lead> {
  constructor(tenantContext: TenantContextStore) {
    super(Lead, tenantContext);
  }

  listForCurrentOrganization(): Promise<Lead[]> {
    return this.find({ order: { createdAt: 'DESC' } });
  }

  findByIdInCurrentOrganization(id: string): Promise<Lead | null> {
    return this.findOne({ where: { id } });
  }
}
