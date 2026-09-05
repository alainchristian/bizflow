import { Injectable } from '@nestjs/common';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository.js';
import { TenantContextStore } from '../../common/tenant-context/tenant-context.store.js';
import { TaxRule } from '../entities/tax-rule.entity.js';

@Injectable()
export class TaxRulesRepository extends TenantScopedRepository<TaxRule> {
  constructor(tenantContext: TenantContextStore) {
    super(TaxRule, tenantContext);
  }

  listForCurrentOrganization(): Promise<TaxRule[]> {
    return this.find({ order: { createdAt: 'DESC' } });
  }

  findByIdInCurrentOrganization(id: string): Promise<TaxRule | null> {
    return this.findOne({ where: { id } });
  }
}
