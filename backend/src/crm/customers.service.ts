import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { Contact } from './entities/contact.entity.js';
import { Customer } from './entities/customer.entity.js';
import { CustomerNote } from './entities/customer-note.entity.js';
import { ContactsRepository } from './repositories/contacts.repository.js';
import { CustomerNotesRepository } from './repositories/customer-notes.repository.js';
import { CustomersRepository } from './repositories/customers.repository.js';

export interface CustomerDetail extends Customer {
  contacts: Contact[];
  notes: CustomerNote[];
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly contactsRepository: ContactsRepository,
    private readonly customerNotesRepository: CustomerNotesRepository,
  ) {}

  list(): Promise<Customer[]> {
    return this.customersRepository.listForCurrentOrganization();
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findByIdInCurrentOrganization(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async findDetailById(id: string): Promise<CustomerDetail> {
    const customer = await this.findById(id);
    const [contacts, notes] = await Promise.all([
      this.contactsRepository.listForCustomer(id),
      this.customerNotesRepository.listForCustomer(id),
    ]);
    return { ...customer, contacts, notes };
  }

  async addContact(customerId: string, dto: CreateContactDto): Promise<Contact> {
    await this.findById(customerId); // 404s before creating a contact for a nonexistent/foreign customer
    return this.contactsRepository.create({
      customerId,
      fullName: dto.fullName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
    });
  }

  async addNote(customerId: string, authorUserId: string, body: string): Promise<CustomerNote> {
    await this.findById(customerId);
    return this.customerNotesRepository.create({ customerId, authorUserId, body });
  }
}
