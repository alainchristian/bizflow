import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MembershipRole } from '../../../common/memberships/membership-role.enum.js';
import { InvitationStatus } from '../invitation-status.enum.js';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'enum', enum: MembershipRole, default: MembershipRole.MEMBER })
  role!: MembershipRole;

  @Column({ type: 'uuid', name: 'invited_by_user_id' })
  invitedByUserId!: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
