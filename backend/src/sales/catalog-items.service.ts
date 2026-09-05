import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto.js';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto.js';
import { CatalogItem } from './entities/catalog-item.entity.js';
import { CatalogItemsRepository } from './repositories/catalog-items.repository.js';
import { TaxRulesRepository } from './repositories/tax-rules.repository.js';

@Injectable()
export class CatalogItemsService {
  constructor(
    private readonly catalogItemsRepository: CatalogItemsRepository,
    private readonly taxRulesRepository: TaxRulesRepository,
  ) {}

  async create(dto: CreateCatalogItemDto): Promise<CatalogItem> {
    if (dto.taxRuleId) {
      await this.assertTaxRuleExists(dto.taxRuleId);
    }

    return this.catalogItemsRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      priceAmount: dto.priceAmount,
      currencyCode: dto.currencyCode,
      sku: dto.sku ?? null,
      isActive: dto.isActive ?? true,
      taxRuleId: dto.taxRuleId ?? null,
    });
  }

  list(): Promise<CatalogItem[]> {
    return this.catalogItemsRepository.listForCurrentOrganization();
  }

  async findById(id: string): Promise<CatalogItem> {
    const item = await this.catalogItemsRepository.findByIdInCurrentOrganization(id);
    if (!item) {
      throw new NotFoundException('Catalog item not found');
    }
    return item;
  }

  async update(id: string, dto: UpdateCatalogItemDto): Promise<CatalogItem> {
    if (dto.taxRuleId) {
      await this.assertTaxRuleExists(dto.taxRuleId);
    }

    const item = await this.findById(id);
    return this.catalogItemsRepository.mergeAndSave(item, dto);
  }

  /**
   * A cross-tenant tax rule id would otherwise fail silently at the
   * database FK check (or worse, succeed if IDs ever collided across a
   * schema change) -- checking it through TaxRulesRepository keeps this
   * scoped to the current organization the same way every other lookup
   * here is, and gives a clear 400 instead of a raw DB error.
   */
  private async assertTaxRuleExists(taxRuleId: string): Promise<void> {
    const taxRule = await this.taxRulesRepository.findByIdInCurrentOrganization(taxRuleId);
    if (!taxRule) {
      throw new BadRequestException('taxRuleId does not refer to a tax rule in this organization');
    }
  }
}
