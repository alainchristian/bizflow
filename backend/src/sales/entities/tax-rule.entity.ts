import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tax_rules')
export class TaxRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  /**
   * Basis points (1 bp = 0.01%), e.g. 725 = 7.25% -- an integer, per
   * CLAUDE.md's "never floats for money/financial values" rule extended to
   * tax rates for the same reason: a rate like 7.25% has no exact binary
   * float representation, and rate * amount arithmetic on floats risks the
   * same off-by-a-cent bugs money itself is protected from.
   */
  @Column({ type: 'integer', name: 'rate_basis_points' })
  rateBasisPoints!: number;

  /**
   * Whether a catalog item's listed price already includes this tax
   * (back the tax out of the price) vs. this tax being added on top at
   * invoice time. Per catalog item/line, not a single org-wide setting --
   * see docs/architecture/tax-engine.md for how mixed inclusive/exclusive
   * rules on the same line are resolved.
   */
  @Column({ type: 'boolean', name: 'is_inclusive', default: false })
  isInclusive!: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
