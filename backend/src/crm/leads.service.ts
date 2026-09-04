import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto.js';
import { Customer } from './entities/customer.entity.js';
import { Lead } from './entities/lead.entity.js';
import { LeadStatus } from './lead-status.enum.js';
import { CustomersRepository } from './repositories/customers.repository.js';
import { LeadsRepository } from './repositories/leads.repository.js';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly customersRepository: CustomersRepository,
  ) {}

  create(dto: CreateLeadDto): Promise<Lead> {
    return this.leadsRepository.create({
      fullName: dto.fullName,
      companyName: dto.companyName ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      source: dto.source ?? null,
    });
  }

  list(): Promise<Lead[]> {
    return this.leadsRepository.listForCurrentOrganization();
  }

  async findById(id: string): Promise<Lead> {
    const lead = await this.leadsRepository.findByIdInCurrentOrganization(id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  /**
   * Converting never deletes or overwrites the lead -- it stays exactly as
   * it was (source, original contact details, full history), just marked
   * `converted` and linked to the new customer both ways
   * (`Lead.convertedCustomerId` / `Customer.convertedFromLeadId`), per the
   * build order's explicit "preserve lead source/history" requirement.
   */
  async convert(id: string): Promise<Customer> {
    const lead = await this.findById(id);
    if (lead.status === LeadStatus.CONVERTED) {
      throw new ConflictException('This lead has already been converted');
    }

    const customer = await this.customersRepository.create({
      name: lead.companyName ?? lead.fullName,
      email: lead.email,
      phone: lead.phone,
      convertedFromLeadId: lead.id,
    });

    lead.status = LeadStatus.CONVERTED;
    lead.convertedCustomerId = customer.id;
    await this.leadsRepository.save(lead);

    return customer;
  }
}
