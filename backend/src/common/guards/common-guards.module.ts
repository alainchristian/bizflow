import { Global, Module } from '@nestjs/common';
import { JwtConfigModule } from '../jwt-config.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OrganizationContextGuard } from './organization-context.guard.js';
import { PermissionGuard } from './permission.guard.js';

/**
 * Global so `@UseGuards(JwtAuthGuard)` / `@UseGuards(JwtAuthGuard,
 * OrganizationContextGuard)` / `@UseGuards(JwtAuthGuard,
 * OrganizationContextGuard, PermissionGuard)` resolve from any module
 * without each one needing to import this explicitly -- every
 * authenticated route needs the first, every tenant-scoped one also needs
 * the second, and every permission-gated one also needs the third, in
 * that order.
 */
@Global()
@Module({
  imports: [JwtConfigModule, MembershipsModule],
  providers: [JwtAuthGuard, OrganizationContextGuard, PermissionGuard],
  exports: [JwtAuthGuard, OrganizationContextGuard, PermissionGuard],
})
export class CommonGuardsModule {}
