import { Injectable } from '@nestjs/common';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository.js';
import { TenantContextStore } from '../../common/tenant-context/tenant-context.store.js';
import { CatalogItem } from '../entities/catalog-item.entity.js';

@Injectable()
export class CatalogItemsRepository extends TenantScopedRepository<CatalogItem> {
  constructor(tenantContext: TenantContextStore) {
    super(CatalogItem, tenantContext);
  }

  listForCurrentOrganization(): Promise<CatalogItem[]> {
    return this.find({ order: { createdAt: 'DESC' } });
  }

  findByIdInCurrentOrganization(id: string): Promise<CatalogItem | null> {
    return this.findOne({ where: { id } });
  }
}
