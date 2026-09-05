import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../common/guards/organization-context.guard.js';
import { PermissionGuard } from '../common/guards/permission.guard.js';
import { Permission } from '../common/permissions/permission.enum.js';
import { CatalogItemsService } from './catalog-items.service.js';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto.js';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto.js';

@Controller('sales/catalog-items')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionGuard)
export class CatalogItemsController {
  constructor(private readonly catalogItemsService: CatalogItemsService) {}

  @RequirePermission(Permission.SALES_CATALOG_ITEMS_VIEW)
  @Get()
  list() {
    return this.catalogItemsService.list();
  }

  @RequirePermission(Permission.SALES_CATALOG_ITEMS_VIEW)
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.catalogItemsService.findById(id);
  }

  @RequirePermission(Permission.SALES_CATALOG_ITEMS_CREATE)
  @Post()
  create(@Body() dto: CreateCatalogItemDto) {
    return this.catalogItemsService.create(dto);
  }

  @RequirePermission(Permission.SALES_CATALOG_ITEMS_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.catalogItemsService.update(id, dto);
  }
}
