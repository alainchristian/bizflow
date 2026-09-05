import { Module } from '@nestjs/common';
import { CommonGuardsModule } from '../common/guards/common-guards.module.js';
import { CatalogItemsController } from './catalog-items.controller.js';
import { CatalogItemsService } from './catalog-items.service.js';
import { CatalogItemsRepository } from './repositories/catalog-items.repository.js';
import { TaxRulesRepository } from './repositories/tax-rules.repository.js';
import { TaxCalculationService } from './tax-calculation.service.js';
import { TaxRulesController } from './tax-rules.controller.js';
import { TaxRulesService } from './tax-rules.service.js';

@Module({
  imports: [CommonGuardsModule],
  controllers: [CatalogItemsController, TaxRulesController],
  providers: [
    CatalogItemsService,
    CatalogItemsRepository,
    TaxRulesService,
    TaxRulesRepository,
    TaxCalculationService,
  ],
  // TaxCalculationService is pure domain logic meant to be called directly
  // by the quotations/invoicing services once they exist (Steps 8-9) --
  // exported now so that cross-module dependency is just a normal Nest
  // import, not a re-implementation.
  exports: [TaxCalculationService],
})
export class SalesModule {}
