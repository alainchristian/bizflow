import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../common/guards/organization-context.guard.js';
import { PermissionGuard } from '../common/guards/permission.guard.js';
import { Permission } from '../common/permissions/permission.enum.js';
import type { JwtPayload } from '../common/types/jwt-payload.type.js';
import { CustomersService } from './customers.service.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto.js';

@Controller('crm/customers')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @RequirePermission(Permission.CRM_CUSTOMERS_VIEW)
  @Get()
  list() {
    return this.customersService.list();
  }

  @RequirePermission(Permission.CRM_CUSTOMERS_VIEW)
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.customersService.findDetailById(id);
  }

  @RequirePermission(Permission.CRM_CUSTOMERS_MANAGE)
  @Post(':id/contacts')
  addContact(@Param('id') id: string, @Body() dto: CreateContactDto) {
    return this.customersService.addContact(id, dto);
  }

  @RequirePermission(Permission.CRM_CUSTOMERS_MANAGE)
  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCustomerNoteDto,
  ) {
    return this.customersService.addNote(id, user.sub, dto.body);
  }
}
