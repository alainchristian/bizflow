import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { TenantContextStore } from './tenant-context.store.js';

/**
 * Opens one database transaction per request -- via a single `QueryRunner`
 * pinned to one connection for the request's duration -- and establishes
 * `TenantContextStore` for the rest of the pipeline (guards, controller,
 * services, repositories), so the `SET LOCAL`-style session variables the
 * guards set are visible to every query the request makes, and nowhere
 * else.
 *
 * This middleware only *opens* the transaction and calls `next()`
 * synchronously -- it does not commit or roll back. That happens in
 * `TenantTransactionInterceptor` (commit, on success) and
 * `TenantTransactionExceptionFilter` (rollback, on any thrown exception),
 * which both run *before* Nest sends the response. An earlier version of
 * this middleware waited for the response to finish and committed
 * afterwards -- which meant the client could receive a response for a
 * request whose writes hadn't actually landed yet. Under light,
 * sequential load the commit is fast enough that this went unnoticed; it
 * surfaced as sporadic, load-dependent failures (a request immediately
 * following a write acting as though that write hadn't happened) once
 * several e2e spec files ran concurrently against the same database.
 * Committing/rolling back as part of the response pipeline itself, before
 * the response value is allowed to reach the client, is what actually
 * guarantees read-your-own-writes for the very next request.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextStore,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    } catch (error) {
      this.logger.error(error);
      await queryRunner.release().catch(() => {});
      res.status(500).json({ statusCode: 500, message: 'Internal server error' });
      return;
    }

    await this.tenantContext.run(queryRunner, async () => next());
  }
}
