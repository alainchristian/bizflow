import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxRulesService } from './tax-rules.service.js';

describe('TaxRulesService', () => {
  let taxRulesRepository: {
    create: ReturnType<typeof vi.fn>;
    findByIdInCurrentOrganization: ReturnType<typeof vi.fn>;
    listForCurrentOrganization: ReturnType<typeof vi.fn>;
    mergeAndSave: ReturnType<typeof vi.fn>;
  };
  let service: TaxRulesService;

  beforeEach(() => {
    taxRulesRepository = {
      create: vi.fn((input) => Promise.resolve({ id: 'rule-1', ...input })),
      findByIdInCurrentOrganization: vi.fn(),
      listForCurrentOrganization: vi.fn(),
      mergeAndSave: vi.fn((entity, partial) => Promise.resolve({ ...entity, ...partial })),
    };

    service = new TaxRulesService(taxRulesRepository as never);
  });

  it('throws NotFoundException when the rule does not exist', async () => {
    taxRulesRepository.findByIdInCurrentOrganization.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow('Tax rule not found');
  });

  describe('create', () => {
    it('defaults isInclusive to false and isActive to true when omitted', async () => {
      await service.create({ name: 'Sales Tax', rateBasisPoints: 1000 });

      expect(taxRulesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sales Tax', rateBasisPoints: 1000, isInclusive: false, isActive: true }),
      );
    });

    it('passes through explicit isInclusive and isActive', async () => {
      await service.create({ name: 'VAT', rateBasisPoints: 2000, isInclusive: true, isActive: false });

      expect(taxRulesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isInclusive: true, isActive: false }),
      );
    });
  });

  describe('update', () => {
    it('merges a partial update onto the existing rule', async () => {
      taxRulesRepository.findByIdInCurrentOrganization.mockResolvedValue({
        id: 'rule-1',
        name: 'Sales Tax',
        rateBasisPoints: 1000,
        isActive: true,
      });

      const updated = await service.update('rule-1', { isActive: false });

      expect(taxRulesRepository.mergeAndSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rule-1' }),
        { isActive: false },
      );
      expect(updated.isActive).toBe(false);
    });

    it('throws NotFoundException when updating a missing rule', async () => {
      taxRulesRepository.findByIdInCurrentOrganization.mockResolvedValue(null);

      await expect(service.update('missing', { isActive: false })).rejects.toThrow('Tax rule not found');
    });
  });
});
