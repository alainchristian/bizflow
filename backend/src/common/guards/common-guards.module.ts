import { Global, Module } from '@nestjs/common';
import { JwtConfigModule } from '../jwt-config.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OrganizationContextGuard } from './organization-context.guard.js';

/**
 * Global so `@UseGuards(JwtAuthGuard)` / `@UseGuards(JwtAuthGuard,
 * OrganizationContextGuard)` resolve from any module without each one
 * needing to import this explicitly -- every authenticated route needs
 * the former, every tenant-scoped one also needs the latter.
 */
@Global()
@Module({
  imports: [JwtConfigModule, MembershipsModule],
  providers: [JwtAuthGuard, OrganizationContextGuard],
  exports: [JwtAuthGuard, OrganizationContextGuard],
})
export class CommonGuardsModule {}
