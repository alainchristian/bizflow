import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto.js';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto.js';
import { CatalogItem } from './entities/catalog-item.entity.js';
import { CatalogItemsRepository } from './repositories/catalog-items.repository.js';

@Injectable()
export class CatalogItemsService {
  constructor(private readonly catalogItemsRepository: CatalogItemsRepository) {}

  create(dto: CreateCatalogItemDto): Promise<CatalogItem> {
    return this.catalogItemsRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      priceAmount: dto.priceAmount,
      currencyCode: dto.currencyCode,
      sku: dto.sku ?? null,
      isActive: dto.isActive ?? true,
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
    const item = await this.findById(id);
    return this.catalogItemsRepository.mergeAndSave(item, dto);
  }
}
