import { Module } from '@nestjs/common';
import { CommonGuardsModule } from '../common/guards/common-guards.module.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';
import { ContactsRepository } from './repositories/contacts.repository.js';
import { CustomerNotesRepository } from './repositories/customer-notes.repository.js';
import { CustomersRepository } from './repositories/customers.repository.js';
import { LeadsRepository } from './repositories/leads.repository.js';

@Module({
  imports: [CommonGuardsModule],
  controllers: [LeadsController, CustomersController],
  providers: [
    LeadsService,
    CustomersService,
    LeadsRepository,
    CustomersRepository,
    ContactsRepository,
    CustomerNotesRepository,
  ],
})
export class CrmModule {}
