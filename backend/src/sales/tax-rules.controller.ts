import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../common/guards/organization-context.guard.js';
import { PermissionGuard } from '../common/guards/permission.guard.js';
import { Permission } from '../common/permissions/permission.enum.js';
import { CreateTaxRuleDto } from './dto/create-tax-rule.dto.js';
import { UpdateTaxRuleDto } from './dto/update-tax-rule.dto.js';
import { TaxRulesService } from './tax-rules.service.js';

@Controller('sales/tax-rules')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionGuard)
export class TaxRulesController {
  constructor(private readonly taxRulesService: TaxRulesService) {}

  @RequirePermission(Permission.SALES_TAX_RULES_VIEW)
  @Get()
  list() {
    return this.taxRulesService.list();
  }

  @RequirePermission(Permission.SALES_TAX_RULES_VIEW)
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.taxRulesService.findById(id);
  }

  @RequirePermission(Permission.SALES_TAX_RULES_CREATE)
  @Post()
  create(@Body() dto: CreateTaxRuleDto) {
    return this.taxRulesService.create(dto);
  }

  @RequirePermission(Permission.SALES_TAX_RULES_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaxRuleDto) {
    return this.taxRulesService.update(id, dto);
  }
}
