import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * The tenant root. Deliberately has no `organizationId` column -- it *is*
 * the tenant. Its RLS policy keys off `id`, not `organization_id`.
 */
@Entity('organizations')
export class Organization {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'char', length: 2, name: 'country_code' })
  countryCode!: string;

  @Column({ type: 'char', length: 3, name: 'base_currency' })
  baseCurrency!: string;

  @Column({ type: 'varchar', default: 'UTC' })
  timezone!: string;

  @Column({ type: 'varchar', nullable: true })
  industry!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
