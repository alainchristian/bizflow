import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaxRuleDto } from './dto/create-tax-rule.dto.js';
import { UpdateTaxRuleDto } from './dto/update-tax-rule.dto.js';
import { TaxRule } from './entities/tax-rule.entity.js';
import { TaxRulesRepository } from './repositories/tax-rules.repository.js';

@Injectable()
export class TaxRulesService {
  constructor(private readonly taxRulesRepository: TaxRulesRepository) {}

  create(dto: CreateTaxRuleDto): Promise<TaxRule> {
    return this.taxRulesRepository.create({
      name: dto.name,
      rateBasisPoints: dto.rateBasisPoints,
      isInclusive: dto.isInclusive ?? false,
      isActive: dto.isActive ?? true,
    });
  }

  list(): Promise<TaxRule[]> {
    return this.taxRulesRepository.listForCurrentOrganization();
  }

  async findById(id: string): Promise<TaxRule> {
    const rule = await this.taxRulesRepository.findByIdInCurrentOrganization(id);
    if (!rule) {
      throw new NotFoundException('Tax rule not found');
    }
    return rule;
  }

  async update(id: string, dto: UpdateTaxRuleDto): Promise<TaxRule> {
    const rule = await this.findById(id);
    return this.taxRulesRepository.mergeAndSave(rule, dto);
  }
}
