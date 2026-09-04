import { Injectable } from '@nestjs/common';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository.js';
import { TenantContextStore } from '../../common/tenant-context/tenant-context.store.js';
import { Contact } from '../entities/contact.entity.js';

@Injectable()
export class ContactsRepository extends TenantScopedRepository<Contact> {
  constructor(tenantContext: TenantContextStore) {
    super(Contact, tenantContext);
  }

  listForCustomer(customerId: string): Promise<Contact[]> {
    return this.find({ where: { customerId }, order: { createdAt: 'DESC' } });
  }
}
