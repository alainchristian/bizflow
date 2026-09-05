import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../common/database/money.transformer.js';
import { CatalogItemType } from '../catalog-item-type.enum.js';

@Entity('catalog_items')
export class CatalogItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: CatalogItemType })
  type!: CatalogItemType;

  @Column({ type: 'bigint', name: 'price_amount', transformer: bigintTransformer })
  priceAmount!: number;

  @Column({ type: 'char', length: 3, name: 'currency_code' })
  currencyCode!: string;

  /** More relevant to `product` than `service`, but not enforced either way -- an MVP-scale product catalog doesn't need a rigid per-type schema. */
  @Column({ type: 'varchar', nullable: true })
  sku!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  /** Unpopulated until Step 7's tax engine exists; left here now so that migration doesn't have to touch this table again. */
  @Column({ type: 'uuid', name: 'tax_rule_id', nullable: true })
  taxRuleId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
