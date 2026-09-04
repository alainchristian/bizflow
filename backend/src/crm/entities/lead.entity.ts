import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeadStatus } from '../lead-status.enum.js';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar', name: 'full_name' })
  fullName!: string;

  @Column({ type: 'varchar', name: 'company_name', nullable: true })
  companyName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  /**
   * Free text rather than an enum -- MVP doesn't need a rigid, curated list
   * of lead sources yet, and a premature enum here would just mean a
   * migration later to add "referral" or "trade show".
   */
  @Column({ type: 'varchar', nullable: true })
  source!: string | null;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status!: LeadStatus;

  @Column({ type: 'uuid', name: 'assigned_to_user_id', nullable: true })
  assignedToUserId!: string | null;

  /**
   * Set on conversion. The lead row is never deleted or overwritten on
   * conversion -- this and `Customer.convertedFromLeadId` are the two ends
   * of a permanent link preserving lead source/history rather than
   * discarding it, per the build order's explicit requirement.
   */
  @Column({ type: 'uuid', name: 'converted_customer_id', nullable: true })
  convertedCustomerId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
