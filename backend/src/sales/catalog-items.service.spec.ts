import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogItemsService } from './catalog-items.service.js';
import { CatalogItemType } from './catalog-item-type.enum.js';

describe('CatalogItemsService', () => {
  let catalogItemsRepository: {
    create: ReturnType<typeof vi.fn>;
    findByIdInCurrentOrganization: ReturnType<typeof vi.fn>;
    listForCurrentOrganization: ReturnType<typeof vi.fn>;
    mergeAndSave: ReturnType<typeof vi.fn>;
  };
  let service: CatalogItemsService;

  beforeEach(() => {
    catalogItemsRepository = {
      create: vi.fn((input) => Promise.resolve({ id: 'item-1', ...input })),
      findByIdInCurrentOrganization: vi.fn(),
      listForCurrentOrganization: vi.fn(),
      mergeAndSave: vi.fn((entity, partial) => Promise.resolve({ ...entity, ...partial })),
    };

    service = new CatalogItemsService(catalogItemsRepository as never);
  });

  it('throws NotFoundException when the item does not exist', async () => {
    catalogItemsRepository.findByIdInCurrentOrganization.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow('Catalog item not found');
  });

  describe('create', () => {
    it('defaults isActive to true and nullable fields to null when omitted', async () => {
      await service.create({
        name: 'Consulting Hour',
        type: CatalogItemType.SERVICE,
        priceAmount: 15000,
        currencyCode: 'USD',
      });

      expect(catalogItemsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Consulting Hour',
          description: null,
          sku: null,
          isActive: true,
        }),
      );
    });

    it('passes through an explicit isActive: false', async () => {
      await service.create({
        name: 'Discontinued Widget',
        type: CatalogItemType.PRODUCT,
        priceAmount: 999,
        currencyCode: 'USD',
        isActive: false,
      });

      expect(catalogItemsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('update', () => {
    it('merges a partial update onto the existing item', async () => {
      catalogItemsRepository.findByIdInCurrentOrganization.mockResolvedValue({
        id: 'item-1',
        name: 'Consulting Hour',
        isActive: true,
      });

      const updated = await service.update('item-1', { isActive: false });

      expect(catalogItemsRepository.mergeAndSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'item-1' }),
        { isActive: false },
      );
      expect(updated.isActive).toBe(false);
    });

    it('throws NotFoundException when updating a missing item', async () => {
      catalogItemsRepository.findByIdInCurrentOrganization.mockResolvedValue(null);

      await expect(service.update('missing', { isActive: false })).rejects.toThrow(
        'Catalog item not found',
      );
    });
  });
});
