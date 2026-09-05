import { Injectable } from '@nestjs/common';
import {
  TaxBreakdownEntry,
  TaxCalculationResult,
  TaxLineInput,
  TaxLineResult,
  TaxRuleTotal,
} from './tax-calculation.types.js';

/**
 * Pure domain logic, deliberately with no repository/tenant-context
 * dependency -- see docs/architecture/tax-engine.md for the full
 * rounding and inclusive/exclusive design. Meant to be called directly,
 * in-process, by the quotations and invoicing services once they exist
 * (Steps 8-9), not just from this module's own controller.
 */
@Injectable()
export class TaxCalculationService {
  calculate(lines: TaxLineInput[]): TaxCalculationResult {
    const lineResults = lines.map((line) => this.calculateLine(line));

    const subtotal = lineResults.reduce((sum, line) => sum + line.taxableAmount, 0);
    const taxTotal = lineResults.reduce((sum, line) => sum + line.taxTotal, 0);

    const totalsByRule = new Map<string, TaxRuleTotal>();
    for (const line of lineResults) {
      for (const entry of line.breakdown) {
        const existing = totalsByRule.get(entry.taxRuleId);
        if (existing) {
          existing.amount += entry.amount;
        } else {
          totalsByRule.set(entry.taxRuleId, { ...entry } as TaxRuleTotal);
        }
      }
    }

    return {
      lines: lineResults,
      subtotal,
      taxTotal,
      total: subtotal + taxTotal,
      taxTotalsByRule: [...totalsByRule.values()],
    };
  }

  private calculateLine(line: TaxLineInput): TaxLineResult {
    const inclusiveRules = line.taxRules.filter((rule) => rule.isInclusive);
    const combinedInclusiveRate = inclusiveRules.reduce(
      (sum, rule) => sum + rule.rateBasisPoints,
      0,
    );

    let taxableAmount = line.amount;
    const inclusiveAmounts = new Map<string, number>();

    if (inclusiveRules.length > 0 && combinedInclusiveRate > 0) {
      // Back the combined inclusive tax out of the line's price, then
      // distribute it across the individual inclusive rules proportional
      // to their own rate. The last rule absorbs the rounding remainder
      // so the per-rule amounts always sum to exactly `amount - taxableAmount`
      // -- rounding each rule independently instead could leave the
      // breakdown a cent off from the line total.
      taxableAmount = Math.round((line.amount * 10000) / (10000 + combinedInclusiveRate));
      const inclusiveTaxTotal = line.amount - taxableAmount;

      let allocated = 0;
      inclusiveRules.forEach((rule, index) => {
        if (index === inclusiveRules.length - 1) {
          inclusiveAmounts.set(rule.id, inclusiveTaxTotal - allocated);
          return;
        }
        const share = Math.round((taxableAmount * rule.rateBasisPoints) / 10000);
        inclusiveAmounts.set(rule.id, share);
        allocated += share;
      });
    } else {
      // No inclusive rules, or every inclusive rule on this line is 0% --
      // nothing to back out, so every inclusive rule (if any) is just 0.
      for (const rule of inclusiveRules) {
        inclusiveAmounts.set(rule.id, 0);
      }
    }

    // Exclusive rules are computed independently against the taxable base
    // (after any inclusive tax has been backed out) and added on top --
    // this is what lets "federal 5% + state 3%" sum correctly instead of
    // compounding on each other.
    const breakdown: TaxBreakdownEntry[] = line.taxRules.map((rule) => ({
      taxRuleId: rule.id,
      name: rule.name,
      rateBasisPoints: rule.rateBasisPoints,
      amount: rule.isInclusive
        ? (inclusiveAmounts.get(rule.id) ?? 0)
        : Math.round((taxableAmount * rule.rateBasisPoints) / 10000),
    }));

    const taxTotal = breakdown.reduce((sum, entry) => sum + entry.amount, 0);

    return {
      taxableAmount,
      taxTotal,
      total: taxableAmount + taxTotal,
      breakdown,
    };
  }
}
