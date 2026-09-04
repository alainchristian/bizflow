import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../common/guards/organization-context.guard.js';
import type { JwtPayload } from '../common/types/jwt-payload.type.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createOrganization(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.createOrganization(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listMyOrganizations(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.listForUser(user.sub);
  }

  @UseGuards(JwtAuthGuard, OrganizationContextGuard)
  @Get('current')
  getCurrentOrganization() {
    return this.organizationsService.getCurrentOrganization();
  }

  @UseGuards(JwtAuthGuard, OrganizationContextGuard)
  @Patch('current/settings')
  updateCurrentOrganizationSettings(@Body() dto: UpdateOrganizationSettingsDto) {
    return this.organizationsService.updateCurrentOrganizationSettings(dto);
  }
}
