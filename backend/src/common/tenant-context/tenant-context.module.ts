import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextMiddleware } from './tenant-context.middleware.js';
import { TenantContextStore } from './tenant-context.store.js';
import { TenantTransactionExceptionFilter } from './tenant-transaction-exception.filter.js';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor.js';

@Global()
@Module({
  providers: [
    TenantContextStore,
    TenantContextMiddleware,
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
    { provide: APP_FILTER, useClass: TenantTransactionExceptionFilter },
  ],
  exports: [TenantContextStore, TenantContextMiddleware],
})
export class TenantContextModule {}
