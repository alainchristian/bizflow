import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { envValidationSchema } from './config/env.validation.js';
import { Membership } from './common/memberships/entities/membership.entity.js';
import { TenantContextMiddleware } from './common/tenant-context/tenant-context.middleware.js';
import { TenantContextModule } from './common/tenant-context/tenant-context.module.js';
import { CrmModule } from './crm/crm.module.js';
import { Contact } from './crm/entities/contact.entity.js';
import { CustomerNote } from './crm/entities/customer-note.entity.js';
import { Customer } from './crm/entities/customer.entity.js';
import { Lead } from './crm/entities/lead.entity.js';
import { HealthModule } from './health/health.module.js';
import { OrganizationSettings } from './organizations/entities/organization-settings.entity.js';
import { Organization } from './organizations/entities/organization.entity.js';
import { Invitation } from './organizations/invitations/entities/invitation.entity.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { CatalogItem } from './sales/entities/catalog-item.entity.js';
import { SalesModule } from './sales/sales.module.js';
import { User } from './users/entities/user.entity.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          User,
          Organization,
          OrganizationSettings,
          Membership,
          Invitation,
          Lead,
          Customer,
          Contact,
          CustomerNote,
          CatalogItem,
        ],
        synchronize: false,
      }),
    }),
    TenantContextModule,
    HealthModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    CrmModule,
    SalesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // These are the only routes that need no per-request transaction/tenant
    // context: they run before a user is authenticated (or, for health,
    // don't touch tenant data at all). Every other route -- including
    // /auth/me, which already requires JwtAuthGuard -- gets one, since
    // JwtAuthGuard itself needs the tenant context to record the current
    // user for RLS.
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'api/v1', method: RequestMethod.GET },
        { path: 'api/v1/health', method: RequestMethod.GET },
        { path: 'api/v1/auth/register', method: RequestMethod.POST },
        { path: 'api/v1/auth/login', method: RequestMethod.POST },
        { path: 'api/v1/auth/refresh', method: RequestMethod.POST },
      )
      .forRoutes('{*path}');
  }
}
