import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { MembershipRole } from '../membership-role.enum.js';

@Entity('memberships')
@Unique('UQ_membership_user_org', ['userId', 'organizationId'])
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'enum', enum: MembershipRole, default: MembershipRole.MEMBER })
  role!: MembershipRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
