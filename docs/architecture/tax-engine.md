# Tax Engine (basic)

Implements build-order Step 7. `TaxCalculationService`
(`backend/src/sales/tax-calculation.service.ts`) is pure domain logic with
no repository or tenant-context dependency -- it takes plain data in and
returns plain data out, which is what makes the extensive edge-case unit
tests in `tax-calculation.service.spec.ts` possible without spinning up a
database. Read that spec file for the concrete numbers; this doc explains
*why* the rules are what they are, for whoever wires it into quotations
(Step 8) or invoicing (Step 9) next.

## What Step 7 built, and what it deliberately didn't

Per the blueprint (Section 29), a full tax engine supports per-rule
`applies_to` targeting (which catalog items/customers a rule applies to),
effective-dated rules, and customer tax-exemption flags. None of that
exists yet. Step 7 built exactly what its acceptance criteria needs --
"correct tax totals computed for a range of test scenarios" -- and no
more:

- `tax_rules` table: `name`, `rate_basis_points`, `is_inclusive`,
  `is_active`. Tenant-scoped and RLS-enforced on the same pattern as every
  other table since Step 3.
- `TaxCalculationService.calculate()`: given a list of lines, each with an
  amount and the tax rules that apply to it, returns per-line and
  aggregate totals.
- `catalog_items.tax_rule_id` (added as a placeholder column in Step 6) now
  has a real FK and is validated on create/update: `CatalogItemsService`
  checks the id resolves via `TaxRulesRepository` in the current org before
  saving, rather than letting a bad id surface as a raw FK-violation error.

**Not built:** rule-to-item/customer targeting beyond the single
`catalog_items.tax_rule_id` FK, effective dates, tax exemption, and
multi-rule assignment on a catalog item (a catalog item currently has at
most *one* tax rule). Quotation/invoice line items don't exist yet, so
there's nothing to attach a second rule to. When Step 8/9 build line
items, decide then whether "a line references N tax rules" belongs on the
line itself (most likely -- e.g. federal + state on one invoice line) or
stays a catalog-item-level concept; `TaxCalculationService.calculate()`
already accepts an array of rules per line specifically so that decision
doesn't require changing this service.

## Rates are integer basis points, never floats

`rate_basis_points` is an integer where `10000` = 100% (so `725` = 7.25%).
This is CLAUDE.md's "never floats for money" rule extended to tax rates
for the identical reason: `0.0725` has no exact binary floating-point
representation, and multiplying a float rate by an integer money amount
reintroduces exactly the class of off-by-a-cent bug integer money was
supposed to eliminate. All arithmetic in `TaxCalculationService` is
`amount * rateBasisPoints / 10000`, rounded once per rule per line with
`Math.round` (round-half-up; every value here is non-negative, so this
matches the conventional accounting rounding rule without needing a
custom implementation).

## Exclusive tax: add on top, independently per rule

An exclusive rule's tax is computed against the line's taxable base and
added on top. Multiple exclusive rules (e.g. federal 5% + state 3%) are
each computed independently against the *same* base and summed -- they do
not compound on each other (state tax is not charged on top of federal
tax). This is the ordinary "sales tax" model most US-style tax setups
expect.

## Inclusive tax: back it out, then distribute proportionally

An inclusive rule means the line's given `amount` already contains that
tax (VAT-style pricing). To recover the pre-tax base from a combined rate
`r` (in basis points):

```
taxableAmount = round(amount * 10000 / (10000 + r))
```

When multiple inclusive rules apply to the same line, `r` is their summed
rate, and the combined backed-out tax (`amount - taxableAmount`) is then
split across the individual rules proportional to each rule's own rate --
**except the last rule, which absorbs whatever rounding remainder is
left**, so the per-rule breakdown always sums to *exactly* the line's
total tax. Rounding each rule's share independently instead can leave the
breakdown a cent off from the line total, which is the kind of
discrepancy that turns into a confused support ticket on a real invoice.
See `tax-calculation.service.spec.ts`'s "reconciles exactly even when
proportional rounding would otherwise leave a remainder" test for a
concrete case where naive per-rule rounding would have failed this.

## Mixed inclusive + exclusive rules on one line

Inclusive rules are resolved first (against the line's original `amount`,
producing `taxableAmount`), then exclusive rules are computed against that
resulting `taxableAmount` and added on top. This means "amount" is the
single source of truth a line's price is quoted against, and the mixed
case falls out of the exclusive/inclusive rules above without needing a
third code path -- verify against the "mixed" describe block in the spec
file if extending this.

## Snapshotting, not live recalculation (a decision for Step 8/9, noted here)

The blueprint says invoices compute tax at creation time and snapshot it
onto the invoice, not recalculate later if the underlying `tax_rules` row
changes. `TaxCalculationService` already supports this correctly *as long
as the caller passes it the tax rule's rate/name/inclusive flag as they
were at calculation time*, not a live join to the `tax_rules` table by id.
When Step 8/9 build quotation/invoice line items, they should copy the
rule's fields onto the line item (or a line-item-tax-breakdown row) at
creation time, not store just a `tax_rule_id` and re-look-it-up when
rendering -- otherwise editing a tax rate would silently rewrite the tax
on every past invoice that used it, which is both wrong and likely a
compliance problem.
