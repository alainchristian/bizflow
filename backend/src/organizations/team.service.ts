import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole } from '../common/memberships/membership-role.enum.js';
import { MembershipsService } from '../common/memberships/memberships.service.js';
import { UsersService } from '../users/users.service.js';
import { InvitationsService } from './invitations/invitations.service.js';

export interface TeamMember {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  role: MembershipRole;
}

@Injectable()
export class TeamService {
  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly usersService: UsersService,
    private readonly invitationsService: InvitationsService,
  ) {}

  async listMembers(organizationId: string): Promise<TeamMember[]> {
    const memberships = await this.membershipsService.listForOrganization(organizationId);
    const users = await this.usersService.findByIds(memberships.map((m) => m.userId));

    return memberships.map((membership) => {
      const user = users.find((u) => u.id === membership.userId);
      return {
        membershipId: membership.id,
        userId: membership.userId,
        email: user?.email ?? '(unknown)',
        fullName: user?.fullName ?? '(unknown)',
        role: membership.role,
      };
    });
  }

  async inviteMember(organizationId: string, invitedByUserId: string, email: string, role: MembershipRole) {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      const existingMembership = await this.membershipsService.findMembership(
        existingUser.id,
        organizationId,
      );
      if (existingMembership) {
        throw new ConflictException('This person is already a member of the organization');
      }
    }

    return this.invitationsService.createInvitation(email, role, invitedByUserId);
  }

  listPendingInvitations() {
    return this.invitationsService.listPendingForCurrentOrganization();
  }

  async revokeInvitation(id: string) {
    const revoked = await this.invitationsService.revoke(id);
    if (!revoked) {
      throw new NotFoundException('Invitation not found');
    }
    return revoked;
  }

  async acceptInvitation(userId: string, userEmail: string, invitationId: string) {
    const invitation = await this.invitationsService.findPendingByIdForEmail(
      invitationId,
      userEmail,
    );
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const existingMembership = await this.membershipsService.findMembership(
      userId,
      invitation.organizationId,
    );
    const membership =
      existingMembership ??
      (await this.membershipsService.createMembership(
        userId,
        invitation.organizationId,
        invitation.role,
      ));

    await this.invitationsService.markAccepted(invitation);
    return membership;
  }

  async updateMemberRole(organizationId: string, membershipId: string, role: MembershipRole) {
    const membership = await this.membershipsService.findInOrganization(
      organizationId,
      membershipId,
    );
    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    if (membership.role === MembershipRole.OWNER && role !== MembershipRole.OWNER) {
      await this.assertNotLastOwner(organizationId);
    }

    return this.membershipsService.updateRole(membership, role);
  }

  async removeMember(organizationId: string, membershipId: string): Promise<void> {
    const membership = await this.membershipsService.findInOrganization(
      organizationId,
      membershipId,
    );
    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    if (membership.role === MembershipRole.OWNER) {
      await this.assertNotLastOwner(organizationId);
    }

    await this.membershipsService.remove(membership);
  }

  private async assertNotLastOwner(organizationId: string): Promise<void> {
    const ownerCount = await this.membershipsService.countOwners(organizationId);
    if (ownerCount <= 1) {
      throw new BadRequestException(
        'An organization must always have at least one owner',
      );
    }
  }
}
