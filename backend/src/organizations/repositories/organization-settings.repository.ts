import { Injectable } from '@nestjs/common';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository.js';
import { TenantContextStore } from '../../common/tenant-context/tenant-context.store.js';
import { OrganizationSettings } from '../entities/organization-settings.entity.js';

@Injectable()
export class OrganizationSettingsRepository extends TenantScopedRepository<OrganizationSettings> {
  constructor(tenantContext: TenantContextStore) {
    super(OrganizationSettings, tenantContext);
  }

  findForCurrentOrganization(): Promise<OrganizationSettings | null> {
    return this.findOne({ where: {} });
  }
}
