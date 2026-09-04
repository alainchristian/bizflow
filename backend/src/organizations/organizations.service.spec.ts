import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipRole } from '../common/memberships/membership-role.enum.js';
import { MembershipsService } from '../common/memberships/memberships.service.js';
import { TenantContextStore } from '../common/tenant-context/tenant-context.store.js';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationSettingsRepository } from './repositories/organization-settings.repository.js';

describe('OrganizationsService', () => {
  let organizationsRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let tenantContext: {
    organizationId: string | null;
    getRepository: ReturnType<typeof vi.fn>;
    setOrganizationId: ReturnType<typeof vi.fn>;
  };
  let membershipsService: {
    listForUser: ReturnType<typeof vi.fn>;
    createMembership: ReturnType<typeof vi.fn>;
  };
  let organizationSettings: {
    create: ReturnType<typeof vi.fn>;
    findForCurrentOrganization: ReturnType<typeof vi.fn>;
    mergeAndSave: ReturnType<typeof vi.fn>;
  };
  let service: OrganizationsService;

  beforeEach(() => {
    organizationsRepository = {
      create: vi.fn((input) => input),
      save: vi.fn((entity) => Promise.resolve(entity)),
      find: vi.fn(),
      findOne: vi.fn(),
    };
    tenantContext = {
      organizationId: null,
      getRepository: vi.fn(() => organizationsRepository),
      setOrganizationId: vi.fn(async (id: string) => {
        tenantContext.organizationId = id;
      }),
    };
    membershipsService = {
      listForUser: vi.fn(),
      createMembership: vi.fn(),
    };
    organizationSettings = {
      create: vi.fn(),
      findForCurrentOrganization: vi.fn(),
      mergeAndSave: vi.fn(),
    };

    service = new OrganizationsService(
      tenantContext as unknown as TenantContextStore,
      membershipsService as unknown as MembershipsService,
      organizationSettings as unknown as OrganizationSettingsRepository,
    );
  });

  describe('createOrganization', () => {
    it('sets the organization context before creating dependent rows', async () => {
      const callOrder: string[] = [];
      tenantContext.setOrganizationId.mockImplementation(async (id: string) => {
        tenantContext.organizationId = id;
        callOrder.push('setOrganizationId');
      });
      organizationSettings.create.mockImplementation(() => {
        callOrder.push('createSettings');
        return Promise.resolve({});
      });
      membershipsService.createMembership.mockImplementation(() => {
        callOrder.push('createMembership');
        return Promise.resolve({});
      });

      await service.createOrganization('user-1', {
        name: 'Acme',
        countryCode: 'US',
        baseCurrency: 'USD',
      });

      expect(callOrder).toEqual(['setOrganizationId', 'createSettings', 'createMembership']);
    });

    it('makes the creating user the owner', async () => {
      const result = await service.createOrganization('user-1', {
        name: 'Acme',
        countryCode: 'US',
        baseCurrency: 'USD',
      });

      expect(result.role).toBe(MembershipRole.OWNER);
      expect(membershipsService.createMembership).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
        MembershipRole.OWNER,
      );
    });
  });

  describe('listForUser', () => {
    it('returns an empty array without querying organizations for a user with no memberships', async () => {
      membershipsService.listForUser.mockResolvedValue([]);

      const result = await service.listForUser('user-1');

      expect(result).toEqual([]);
      expect(organizationsRepository.find).not.toHaveBeenCalled();
    });

    it('attaches each membership role to its organization', async () => {
      membershipsService.listForUser.mockResolvedValue([
        { organizationId: 'org-1', role: MembershipRole.ADMIN },
      ]);
      organizationsRepository.find.mockResolvedValue([
        { id: 'org-1', name: 'Acme', countryCode: 'US', baseCurrency: 'USD' },
      ]);

      const result = await service.listForUser('user-1');

      expect(result).toEqual([
        { id: 'org-1', name: 'Acme', countryCode: 'US', baseCurrency: 'USD', role: 'admin' },
      ]);
    });
  });

  describe('getCurrentOrganization', () => {
    it('throws if no organization context is set', async () => {
      await expect(service.getCurrentOrganization()).rejects.toThrow(
        'No organization context is set',
      );
    });

    it('throws NotFoundException if the organization row is missing', async () => {
      tenantContext.organizationId = 'org-1';
      organizationsRepository.findOne.mockResolvedValue(null);

      await expect(service.getCurrentOrganization()).rejects.toThrow('Organization not found');
    });
  });
});
