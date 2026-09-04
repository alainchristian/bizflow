import { Module } from '@nestjs/common';
import { CommonGuardsModule } from '../common/guards/common-guards.module.js';
import { MembershipsModule } from '../common/memberships/memberships.module.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationSettingsRepository } from './repositories/organization-settings.repository.js';

@Module({
  imports: [MembershipsModule, CommonGuardsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationSettingsRepository],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
