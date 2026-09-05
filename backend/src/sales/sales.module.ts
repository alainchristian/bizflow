import { Module } from '@nestjs/common';
import { CommonGuardsModule } from '../common/guards/common-guards.module.js';
import { CatalogItemsController } from './catalog-items.controller.js';
import { CatalogItemsService } from './catalog-items.service.js';
import { CatalogItemsRepository } from './repositories/catalog-items.repository.js';

@Module({
  imports: [CommonGuardsModule],
  controllers: [CatalogItemsController],
  providers: [CatalogItemsService, CatalogItemsRepository],
})
export class SalesModule {}
