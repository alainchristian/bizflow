import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { EntityManager, EntityTarget, ObjectLiteral, QueryRunner, Repository } from 'typeorm';

interface TenantContext {
  queryRunner: QueryRunner;
  userId: string | null;
  organizationId: string | null;
}

/**
 * Per-request tenant context, backed by AsyncLocalStorage.
 *
 * `TenantContextMiddleware` opens one database transaction per request
 * (via a single `QueryRunner`, pinned to one connection for the request's
 * duration) and establishes the store for its lifetime.
 * `TenantTransactionInterceptor` commits it once the handler succeeds --
 * *before* the response is allowed to reach the client, not after (see
 * that file for why the ordering matters) -- and
 * `TenantTransactionExceptionFilter` rolls it back on any thrown
 * exception, from a guard, pipe, or the controller itself.
 *
 * `JwtAuthGuard` and `OrganizationContextGuard` populate
 * `userId`/`organizationId` on it (after verifying them), which also
 * pushes the equivalent `app.current_user_id` / `app.current_org_id`
 * Postgres session variables that the RLS policies key off. Everything
 * downstream (guards, services, repositories) must read the database
 * through `manager`/`getRepository` here rather than an
 * `@InjectRepository`-bound one, or it runs on a different connection
 * where those session variables were never set.
 */
@Injectable()
export class TenantContextStore {
  private readonly als = new AsyncLocalStorage<TenantContext>();

  run<T>(queryRunner: QueryRunner, callback: () => Promise<T>): Promise<T> {
    return this.als.run({ queryRunner, userId: null, organizationId: null }, callback);
  }

  private get context(): TenantContext {
    const context = this.als.getStore();
    if (!context) {
      throw new Error(
        'No tenant context is active for this request. Is TenantContextMiddleware applied to this route?',
      );
    }
    return context;
  }

  get manager(): EntityManager {
    return this.context.queryRunner.manager;
  }

  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return this.manager.getRepository(entity);
  }

  get userId(): string | null {
    return this.context.userId;
  }

  get organizationId(): string | null {
    return this.context.organizationId;
  }

  async setUserId(userId: string): Promise<void> {
    this.context.userId = userId;
    await this.manager.query('SELECT set_config($1, $2, true)', [
      'app.current_user_id',
      userId,
    ]);
  }

  async setOrganizationId(organizationId: string): Promise<void> {
    this.context.organizationId = organizationId;
    await this.manager.query('SELECT set_config($1, $2, true)', [
      'app.current_org_id',
      organizationId,
    ]);
  }

  /**
   * Non-throwing, unlike everything above -- `TenantTransactionInterceptor`
   * and `TenantTransactionExceptionFilter` are global, so they also run for
   * routes `TenantContextMiddleware` deliberately excludes (health, public
   * auth endpoints), where there is legitimately no active transaction to
   * commit or roll back.
   */
  getActiveQueryRunner(): QueryRunner | undefined {
    return this.als.getStore()?.queryRunner;
  }
}
