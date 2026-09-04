import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { TenantContextStore } from './tenant-context.store.js';

/**
 * Commits the current request's transaction (opened by
 * `TenantContextMiddleware`) -- but not until *after* the handler has
 * produced its result and *before* that result is allowed to reach the
 * client. `mergeMap` (not `tap`) is what makes that ordering real: `tap`'s
 * callback can be async, but RxJS doesn't wait for it before continuing
 * the stream, so a `tap`-based commit would reintroduce the exact
 * respond-before-commit race this exists to close (see
 * `tenant-context.middleware.ts`). `mergeMap` only emits once its
 * returned promise resolves, so the response genuinely waits for the
 * commit.
 *
 * A no-op for routes with no active transaction (health, public auth
 * endpoints) -- `getActiveQueryRunner()` is the non-throwing accessor for
 * exactly that reason, since this interceptor is registered globally.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextStore) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (data) => {
        const queryRunner = this.tenantContext.getActiveQueryRunner();
        if (queryRunner?.isTransactionActive) {
          await queryRunner.commitTransaction();
        }
        if (queryRunner && !queryRunner.isReleased) {
          await queryRunner.release();
        }
        return data;
      }),
    );
  }
}
