import { Injectable } from '@nestjs/common';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository.js';
import { TenantContextStore } from '../../common/tenant-context/tenant-context.store.js';
import { Customer } from '../entities/customer.entity.js';

@Injectable()
export class CustomersRepository extends TenantScopedRepository<Customer> {
  constructor(tenantContext: TenantContextStore) {
    super(Customer, tenantContext);
  }

  listForCurrentOrganization(): Promise<Customer[]> {
    return this.find({ order: { createdAt: 'DESC' } });
  }

  findByIdInCurrentOrganization(id: string): Promise<Customer | null> {
    return this.findOne({ where: { id } });
  }
}
