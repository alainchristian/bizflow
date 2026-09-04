import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../common/guards/organization-context.guard.js';
import { PermissionGuard } from '../common/guards/permission.guard.js';
import { Permission } from '../common/permissions/permission.enum.js';
import { TenantContextStore } from '../common/tenant-context/tenant-context.store.js';
import type { JwtPayload } from '../common/types/jwt-payload.type.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { TeamService } from './team.service.js';

/**
 * Every route here runs behind all three guards, in order:
 * `JwtAuthGuard` (who is calling) -> `OrganizationContextGuard` (which org,
 * verified via a real membership) -> `PermissionGuard` (does that user's
 * role in that org grant the declared `@RequirePermission`). Dropping or
 * reordering any of the three would either leave `organizationId`/`userId`
 * unset (the later guards throw rather than silently no-op) or skip the
 * role check entirely -- see `docs/multi-tenancy/tenant-isolation.md` for
 * the full guard-composition explanation.
 */
@Controller('organizations/current')
@UseGuards(JwtAuthGuard, OrganizationContextGuard)
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly tenantContext: TenantContextStore,
  ) {}

  @Get('members')
  listMembers() {
    return this.teamService.listMembers(this.organizationId);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.ORGANIZATIONS_MEMBERS_MANAGE_ROLES)
  @Patch('members/:membershipId/role')
  updateMemberRole(
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamService.updateMemberRole(this.organizationId, membershipId, dto.role);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.ORGANIZATIONS_MEMBERS_REMOVE)
  @Delete('members/:membershipId')
  removeMember(@Param('membershipId') membershipId: string) {
    return this.teamService.removeMember(this.organizationId, membershipId);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.ORGANIZATIONS_MEMBERS_INVITE)
  @Post('invitations')
  inviteMember(@CurrentUser() user: JwtPayload, @Body() dto: InviteMemberDto) {
    return this.teamService.inviteMember(this.organizationId, user.sub, dto.email, dto.role);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.ORGANIZATIONS_MEMBERS_INVITE)
  @Get('invitations')
  listPendingInvitations() {
    return this.teamService.listPendingInvitations();
  }

  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.ORGANIZATIONS_MEMBERS_INVITE)
  @Delete('invitations/:id')
  revokeInvitation(@Param('id') id: string) {
    return this.teamService.revokeInvitation(id);
  }

  private get organizationId(): string {
    const organizationId = this.tenantContext.organizationId;
    if (!organizationId) {
      throw new Error('No organization context is set for this request');
    }
    return organizationId;
  }
}
