/** A tax rule as the calculator needs it -- deliberately not the TaxRule entity, so this stays a pure function of plain data with no ORM/tenant dependency. */
export interface TaxRuleInput {
  id: string;
  name: string;
  /** Basis points: 725 = 7.25%. */
  rateBasisPoints: number;
  isInclusive: boolean;
}

export interface TaxLineInput {
  /**
   * Integer minor units. If any of this line's `taxRules` are inclusive,
   * this is the price *including* those rules' tax; exclusive rules are
   * always added on top of whatever base results after backing out any
   * inclusive tax. See docs/architecture/tax-engine.md for the mixed case.
   */
  amount: number;
  taxRules: TaxRuleInput[];
}

export interface TaxBreakdownEntry {
  taxRuleId: string;
  name: string;
  rateBasisPoints: number;
  /** Integer minor units attributed to this rule for this line. */
  amount: number;
}

export interface TaxLineResult {
  /** The line's amount with any inclusive tax backed out -- always exclusive-of-tax. */
  taxableAmount: number;
  taxTotal: number;
  /** taxableAmount + taxTotal. Equal to the input `amount` when every rule on the line is inclusive. */
  total: number;
  breakdown: TaxBreakdownEntry[];
}

export interface TaxRuleTotal {
  taxRuleId: string;
  name: string;
  rateBasisPoints: number;
  amount: number;
}

export interface TaxCalculationResult {
  lines: TaxLineResult[];
  subtotal: number;
  taxTotal: number;
  total: number;
  /** Tax amounts summed per rule across all lines -- e.g. for an invoice footer showing "VAT 20%: $40.00" once rather than per line. */
  taxTotalsByRule: TaxRuleTotal[];
}
