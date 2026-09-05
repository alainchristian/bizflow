import { describe, expect, it } from 'vitest';
import { TaxCalculationService } from './tax-calculation.service.js';
import { TaxRuleInput } from './tax-calculation.types.js';

const exclusive = (overrides: Partial<TaxRuleInput> = {}): TaxRuleInput => ({
  id: 'rule-exclusive',
  name: 'Sales Tax',
  rateBasisPoints: 1000, // 10%
  isInclusive: false,
  ...overrides,
});

const inclusive = (overrides: Partial<TaxRuleInput> = {}): TaxRuleInput => ({
  id: 'rule-inclusive',
  name: 'VAT',
  rateBasisPoints: 2000, // 20%
  isInclusive: true,
  ...overrides,
});

describe('TaxCalculationService', () => {
  const service = new TaxCalculationService();

  describe('a line with no tax rules', () => {
    it('has zero tax and the amount passes straight through as the total', () => {
      const result = service.calculate([{ amount: 10000, taxRules: [] }]);

      expect(result.lines[0]).toMatchObject({ taxableAmount: 10000, taxTotal: 0, total: 10000 });
      expect(result.subtotal).toBe(10000);
      expect(result.taxTotal).toBe(0);
      expect(result.total).toBe(10000);
      expect(result.taxTotalsByRule).toEqual([]);
    });
  });

  describe('a single exclusive rate', () => {
    it('adds tax on top of the amount', () => {
      const result = service.calculate([{ amount: 10000, taxRules: [exclusive()] }]);

      expect(result.lines[0]).toMatchObject({ taxableAmount: 10000, taxTotal: 1000, total: 11000 });
      expect(result.lines[0].breakdown).toEqual([
        { taxRuleId: 'rule-exclusive', name: 'Sales Tax', rateBasisPoints: 1000, amount: 1000 },
      ]);
    });

    it('rounds a fractional result to the nearest minor unit', () => {
      // 333 * 10% = 33.3 -> rounds to 33
      const result = service.calculate([{ amount: 333, taxRules: [exclusive()] }]);

      expect(result.lines[0]).toMatchObject({ taxableAmount: 333, taxTotal: 33, total: 366 });
    });
  });

  describe('a single inclusive rate', () => {
    it('backs the tax out of the amount instead of adding it on top', () => {
      // 12000 inclusive of 20% VAT -> taxable base is 10000, tax is 2000
      const result = service.calculate([{ amount: 12000, taxRules: [inclusive()] }]);

      expect(result.lines[0]).toMatchObject({ taxableAmount: 10000, taxTotal: 2000, total: 12000 });
      expect(result.lines[0].breakdown).toEqual([
        { taxRuleId: 'rule-inclusive', name: 'VAT', rateBasisPoints: 2000, amount: 2000 },
      ]);
    });

    it('the line total always equals the original amount when every rule is inclusive', () => {
      const result = service.calculate([{ amount: 9999, taxRules: [inclusive()] }]);

      expect(result.lines[0].total).toBe(9999);
    });

    it('a 0% inclusive rule backs out nothing', () => {
      const result = service.calculate([
        { amount: 10000, taxRules: [inclusive({ rateBasisPoints: 0 })] },
      ]);

      expect(result.lines[0]).toMatchObject({ taxableAmount: 10000, taxTotal: 0, total: 10000 });
    });
  });

  describe('multiple simultaneous exclusive rates (e.g. federal + state)', () => {
    it('sums both rates independently against the same base, not compounded', () => {
      const federal = exclusive({ id: 'federal', name: 'Federal', rateBasisPoints: 500 }); // 5%
      const state = exclusive({ id: 'state', name: 'State', rateBasisPoints: 300 }); // 3%

      const result = service.calculate([{ amount: 10000, taxRules: [federal, state] }]);

      expect(result.lines[0]).toMatchObject({ taxableAmount: 10000, taxTotal: 800, total: 10800 });
      expect(result.lines[0].breakdown).toEqual([
        { taxRuleId: 'federal', name: 'Federal', rateBasisPoints: 500, amount: 500 },
        { taxRuleId: 'state', name: 'State', rateBasisPoints: 300, amount: 300 },
      ]);
    });
  });

  describe('multiple simultaneous inclusive rates', () => {
    it('splits the backed-out tax proportionally across the rules and reconciles exactly', () => {
      const ruleA = inclusive({ id: 'a', name: 'A', rateBasisPoints: 1000 }); // 10%
      const ruleB = inclusive({ id: 'b', name: 'B', rateBasisPoints: 500 }); // 5%
      // combined 15%: 11500 inclusive -> taxable base 10000, total tax 1500
      const result = service.calculate([{ amount: 11500, taxRules: [ruleA, ruleB] }]);

      expect(result.lines[0].taxableAmount).toBe(10000);
      expect(result.lines[0].taxTotal).toBe(1500);
      expect(result.lines[0].total).toBe(11500);
      // Individual shares sum exactly to the line's tax total, whatever
      // the rounding on each individual share came out to.
      const sumOfShares = result.lines[0].breakdown.reduce((sum, entry) => sum + entry.amount, 0);
      expect(sumOfShares).toBe(1500);
    });

    it('reconciles exactly even when proportional rounding would otherwise leave a remainder', () => {
      // Chosen so per-rule proportional rounding doesn't divide evenly,
      // to prove the last-rule-absorbs-the-remainder rule actually works.
      const ruleA = inclusive({ id: 'a', name: 'A', rateBasisPoints: 700 });
      const ruleB = inclusive({ id: 'b', name: 'B', rateBasisPoints: 333 });
      const result = service.calculate([{ amount: 10333, taxRules: [ruleA, ruleB] }]);

      const sumOfShares = result.lines[0].breakdown.reduce((sum, entry) => sum + entry.amount, 0);
      expect(sumOfShares).toBe(result.lines[0].taxTotal);
      expect(result.lines[0].taxableAmount + result.lines[0].taxTotal).toBe(10333);
    });
  });

  describe('mixed inclusive and exclusive rules on the same line', () => {
    it('backs out the inclusive rule first, then adds the exclusive rule on top of that base', () => {
      // 12000 inclusive of 20% VAT -> base 10000; then +10% exclusive sales tax on that base
      const result = service.calculate([
        { amount: 12000, taxRules: [inclusive(), exclusive()] },
      ]);

      expect(result.lines[0].taxableAmount).toBe(10000);
      expect(result.lines[0].breakdown).toEqual(
        expect.arrayContaining([
          { taxRuleId: 'rule-inclusive', name: 'VAT', rateBasisPoints: 2000, amount: 2000 },
          { taxRuleId: 'rule-exclusive', name: 'Sales Tax', rateBasisPoints: 1000, amount: 1000 },
        ]),
      );
      // total = base (10000) + inclusive tax (2000, already inside the
      // original 12000) + exclusive tax added on top (1000)
      expect(result.lines[0].total).toBe(13000);
    });
  });

  describe('multiple lines', () => {
    it('aggregates subtotal/taxTotal/total across lines', () => {
      const result = service.calculate([
        { amount: 10000, taxRules: [exclusive()] },
        { amount: 5000, taxRules: [] },
      ]);

      expect(result.subtotal).toBe(15000);
      expect(result.taxTotal).toBe(1000);
      expect(result.total).toBe(16000);
    });

    it('combines the same tax rule across multiple lines into one taxTotalsByRule entry', () => {
      const salesTax = exclusive({ id: 'sales-tax', name: 'Sales Tax', rateBasisPoints: 1000 });

      const result = service.calculate([
        { amount: 10000, taxRules: [salesTax] },
        { amount: 5000, taxRules: [salesTax] },
      ]);

      expect(result.taxTotalsByRule).toEqual([
        { taxRuleId: 'sales-tax', name: 'Sales Tax', rateBasisPoints: 1000, amount: 1500 },
      ]);
    });

    it('keeps different tax rules as separate taxTotalsByRule entries', () => {
      const federal = exclusive({ id: 'federal', name: 'Federal', rateBasisPoints: 500 });
      const state = exclusive({ id: 'state', name: 'State', rateBasisPoints: 300 });

      const result = service.calculate([
        { amount: 10000, taxRules: [federal] },
        { amount: 10000, taxRules: [state] },
      ]);

      expect(result.taxTotalsByRule).toEqual(
        expect.arrayContaining([
          { taxRuleId: 'federal', name: 'Federal', rateBasisPoints: 500, amount: 500 },
          { taxRuleId: 'state', name: 'State', rateBasisPoints: 300, amount: 300 },
        ]),
      );
    });
  });

  describe('edge cases', () => {
    it('a zero-amount line produces zero tax', () => {
      const result = service.calculate([{ amount: 0, taxRules: [exclusive()] }]);

      expect(result.lines[0]).toMatchObject({ taxableAmount: 0, taxTotal: 0, total: 0 });
    });

    it('no lines at all produces zeroed totals', () => {
      const result = service.calculate([]);

      expect(result).toMatchObject({ lines: [], subtotal: 0, taxTotal: 0, total: 0, taxTotalsByRule: [] });
    });

    it('a 0% exclusive rate adds no tax', () => {
      const result = service.calculate([
        { amount: 10000, taxRules: [exclusive({ rateBasisPoints: 0 })] },
      ]);

      expect(result.lines[0]).toMatchObject({ taxableAmount: 10000, taxTotal: 0, total: 10000 });
    });
  });
});
