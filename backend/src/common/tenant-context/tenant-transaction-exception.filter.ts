import { ArgumentsHost, Catch, Injectable } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { TenantContextStore } from './tenant-context.store.js';

/**
 * Rolls back the current request's transaction on any thrown exception --
 * from a guard (401/403/400 are all guard-level in this app), a pipe
 * (validation failures), or the controller/service itself -- before
 * delegating to Nest's normal exception handling for the actual HTTP
 * response. Exception filters catch errors from anywhere in the guard ->
 * pipe -> controller pipeline, which is exactly the coverage
 * `TenantTransactionInterceptor` can't provide on its own: interceptors
 * only wrap the controller call, so a guard throwing never reaches one.
 *
 * Extends `BaseExceptionFilter` and calls `super.catch(...)` after the
 * rollback specifically so the actual response formatting (status code,
 * JSON body shape) stays exactly Nest's default -- this filter only adds
 * the rollback side effect, not a different error response shape.
 */
@Injectable()
@Catch()
export class TenantTransactionExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly tenantContext: TenantContextStore,
    httpAdapterHost: HttpAdapterHost,
  ) {
    super(httpAdapterHost.httpAdapter);
  }

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const queryRunner = this.tenantContext.getActiveQueryRunner();
    if (queryRunner?.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    if (queryRunner && !queryRunner.isReleased) {
      await queryRunner.release();
    }

    super.catch(exception, host);
  }
}
