import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadStatus } from './lead-status.enum.js';
import { LeadsService } from './leads.service.js';

describe('LeadsService', () => {
  let leadsRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findByIdInCurrentOrganization: ReturnType<typeof vi.fn>;
    listForCurrentOrganization: ReturnType<typeof vi.fn>;
  };
  let customersRepository: { create: ReturnType<typeof vi.fn> };
  let service: LeadsService;

  beforeEach(() => {
    leadsRepository = {
      create: vi.fn((input) => Promise.resolve({ id: 'lead-1', status: LeadStatus.NEW, ...input })),
      save: vi.fn((entity) => Promise.resolve(entity)),
      findByIdInCurrentOrganization: vi.fn(),
      listForCurrentOrganization: vi.fn(),
    };
    customersRepository = {
      create: vi.fn((input) => Promise.resolve({ id: 'customer-1', ...input })),
    };

    service = new LeadsService(
      leadsRepository as never,
      customersRepository as never,
    );
  });

  it('throws NotFoundException when the lead does not exist', async () => {
    leadsRepository.findByIdInCurrentOrganization.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow('Lead not found');
  });

  describe('convert', () => {
    it('creates a customer linked back to the lead, and marks the lead converted', async () => {
      leadsRepository.findByIdInCurrentOrganization.mockResolvedValue({
        id: 'lead-1',
        fullName: 'Jane Prospect',
        companyName: 'Acme Co',
        email: 'jane@acme.com',
        phone: null,
        status: LeadStatus.NEW,
        convertedCustomerId: null,
      });

      const customer = await service.convert('lead-1');

      expect(customersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme Co', convertedFromLeadId: 'lead-1' }),
      );
      expect(customer.convertedFromLeadId).toBe('lead-1');

      const [savedLead] = leadsRepository.save.mock.calls[0];
      expect(savedLead.status).toBe(LeadStatus.CONVERTED);
      expect(savedLead.convertedCustomerId).toBe('customer-1');
    });

    it('falls back to the full name when the lead has no company name', async () => {
      leadsRepository.findByIdInCurrentOrganization.mockResolvedValue({
        id: 'lead-1',
        fullName: 'Jane Prospect',
        companyName: null,
        email: null,
        phone: null,
        status: LeadStatus.NEW,
      });

      await service.convert('lead-1');

      expect(customersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Jane Prospect' }),
      );
    });

    it('refuses to convert an already-converted lead', async () => {
      leadsRepository.findByIdInCurrentOrganization.mockResolvedValue({
        id: 'lead-1',
        status: LeadStatus.CONVERTED,
      });

      await expect(service.convert('lead-1')).rejects.toThrow('already been converted');
      expect(customersRepository.create).not.toHaveBeenCalled();
    });
  });
});
