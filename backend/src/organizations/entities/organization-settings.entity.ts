import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity.js';

@Entity('organization_settings')
export class OrganizationSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @OneToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @Column({ type: 'varchar', name: 'date_format', default: 'DD/MM/YYYY' })
  dateFormat!: string;

  @Column({ type: 'varchar', name: 'invoice_number_prefix', default: '' })
  invoiceNumberPrefix!: string;

  @Column({ type: 'int', name: 'invoice_number_next', default: 1 })
  invoiceNumberNext!: number;

  @Column({ type: 'boolean', name: 'tax_inclusive_pricing', default: false })
  taxInclusivePricing!: boolean;

  @Column({ type: 'varchar', name: 'logo_url', nullable: true })
  logoUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
