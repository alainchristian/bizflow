import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { MembershipRole } from '../common/memberships/membership-role.enum.js';
import { MembershipsService } from '../common/memberships/memberships.service.js';
import { TenantContextStore } from '../common/tenant-context/tenant-context.store.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto.js';
import { Organization } from './entities/organization.entity.js';
import { OrganizationSettingsRepository } from './repositories/organization-settings.repository.js';

export interface OrganizationSummary {
  id: string;
  name: string;
  countryCode: string;
  baseCurrency: string;
  role: MembershipRole;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly tenantContext: TenantContextStore,
    private readonly membershipsService: MembershipsService,
    private readonly organizationSettings: OrganizationSettingsRepository,
  ) {}

  private get organizationsRepository() {
    return this.tenantContext.getRepository(Organization);
  }

  /**
   * Creates the organization, its default settings row, and the creating
   * user's owner membership in one go. The new organization's id is
   * generated here (rather than left to a DB default) so it can be pushed
   * into the tenant context -- and therefore `app.current_org_id` -- before
   * any of the three inserts run, satisfying their RLS policies from the
   * first statement rather than needing a bypass for creation.
   */
  async createOrganization(
    userId: string,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationSummary> {
    const organizationId = randomUUID();
    await this.tenantContext.setOrganizationId(organizationId);

    const organization = this.organizationsRepository.create({
      id: organizationId,
      name: dto.name,
      countryCode: dto.countryCode,
      baseCurrency: dto.baseCurrency,
      timezone: dto.timezone ?? 'UTC',
      industry: dto.industry ?? null,
    });
    await this.organizationsRepository.save(organization);

    await this.organizationSettings.create({});

    await this.membershipsService.createMembership(
      userId,
      organizationId,
      MembershipRole.OWNER,
    );

    return {
      id: organization.id,
      name: organization.name,
      countryCode: organization.countryCode,
      baseCurrency: organization.baseCurrency,
      role: MembershipRole.OWNER,
    };
  }

  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.membershipsService.listForUser(userId);
    if (memberships.length === 0) {
      return [];
    }

    const organizations = await this.organizationsRepository.find({
      where: { id: In(memberships.map((membership) => membership.organizationId)) },
    });

    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      countryCode: organization.countryCode,
      baseCurrency: organization.baseCurrency,
      role: memberships.find((m) => m.organizationId === organization.id)!.role,
    }));
  }

  async getCurrentOrganization() {
    const organizationId = this.requireOrganizationId();
    const organization = await this.organizationsRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const settings = await this.organizationSettings.findForCurrentOrganization();
    return { ...organization, settings };
  }

  async updateCurrentOrganizationSettings(dto: UpdateOrganizationSettingsDto) {
    const settings = await this.organizationSettings.findForCurrentOrganization();
    if (!settings) {
      throw new NotFoundException('Organization settings not found');
    }

    return this.organizationSettings.mergeAndSave(settings, dto);
  }

  private requireOrganizationId(): string {
    const organizationId = this.tenantContext.organizationId;
    if (!organizationId) {
      throw new Error('No organization context is set for this request');
    }
    return organizationId;
  }
}
