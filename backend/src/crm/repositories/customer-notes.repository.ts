import { Injectable } from '@nestjs/common';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository.js';
import { TenantContextStore } from '../../common/tenant-context/tenant-context.store.js';
import { CustomerNote } from '../entities/customer-note.entity.js';

@Injectable()
export class CustomerNotesRepository extends TenantScopedRepository<CustomerNote> {
  constructor(tenantContext: TenantContextStore) {
    super(CustomerNote, tenantContext);
  }

  listForCustomer(customerId: string): Promise<CustomerNote[]> {
    return this.find({ where: { customerId }, order: { createdAt: 'DESC' } });
  }
}
