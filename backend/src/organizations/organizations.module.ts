import { Module } from '@nestjs/common';
import { CommonGuardsModule } from '../common/guards/common-guards.module.js';
import { MembershipsModule } from '../common/memberships/memberships.module.js';
import { UsersModule } from '../users/users.module.js';
import { InvitationAcceptController } from './invitation-accept.controller.js';
import { InvitationsService } from './invitations/invitations.service.js';
import { InvitationsRepository } from './invitations/repositories/invitations.repository.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationSettingsRepository } from './repositories/organization-settings.repository.js';
import { TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';

@Module({
  imports: [MembershipsModule, CommonGuardsModule, UsersModule],
  controllers: [OrganizationsController, TeamController, InvitationAcceptController],
  providers: [
    OrganizationsService,
    OrganizationSettingsRepository,
    InvitationsRepository,
    InvitationsService,
    TeamService,
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
