import { IsEmail, IsEnum } from 'class-validator';
import { MembershipRole } from '../../common/memberships/membership-role.enum.js';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
