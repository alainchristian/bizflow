import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../common/guards/organization-context.guard.js';
import { PermissionGuard } from '../common/guards/permission.guard.js';
import { Permission } from '../common/permissions/permission.enum.js';
import { CreateLeadDto } from './dto/create-lead.dto.js';
import { LeadsService } from './leads.service.js';

@Controller('crm/leads')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @RequirePermission(Permission.CRM_LEADS_CREATE)
  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @RequirePermission(Permission.CRM_LEADS_VIEW)
  @Get()
  list() {
    return this.leadsService.list();
  }

  @RequirePermission(Permission.CRM_LEADS_VIEW)
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.leadsService.findById(id);
  }

  @RequirePermission(Permission.CRM_LEADS_CONVERT)
  @Post(':id/convert')
  convert(@Param('id') id: string) {
    return this.leadsService.convert(id);
  }
}
