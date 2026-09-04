import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions/permission.enum.js';

export const PERMISSION_METADATA_KEY = 'requiredPermission';

/**
 * Declares the permission `PermissionGuard` must find on the current
 * user's role before letting the request through. Must be combined with
 * `@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionGuard)`, in
 * that order -- `PermissionGuard` reads the user id and organization id
 * the first two guards already resolved and verified; it does not
 * authenticate or resolve an organization itself.
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_METADATA_KEY, permission);
