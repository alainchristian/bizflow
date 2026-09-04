import { IsEnum } from 'class-validator';
import { MembershipRole } from '../../common/memberships/membership-role.enum.js';

export class UpdateMemberRoleDto {
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
