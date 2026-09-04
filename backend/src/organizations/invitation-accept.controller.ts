import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../common/types/jwt-payload.type.js';
import { TeamService } from './team.service.js';

/**
 * Deliberately not under `organizations/current` and deliberately not
 * behind `OrganizationContextGuard` -- the whole point of this route is to
 * grant a user their *first* relationship to an organization, so there is
 * no existing membership for that guard to verify yet. Only `JwtAuthGuard`
 * applies: you must be logged in as *some* user, and `TeamService` +
 * the invitations RLS policy's email-match branch make sure that user can
 * only ever accept an invitation addressed to their own email.
 */
@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationAcceptController {
  constructor(private readonly teamService: TeamService) {}

  @Post(':id/accept')
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teamService.acceptInvitation(user.sub, user.email, id);
  }
}
