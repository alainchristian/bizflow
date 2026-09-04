import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { TenantContextStore } from './tenant-context.store.js';

/**
 * Opens one database transaction per request and runs the rest of the
 * request (guards, controller, services, repositories) inside it via
 * `TenantContextStore`, so the `SET LOCAL`-style session variables the
 * guards set are visible to every query the request makes, and nowhere
 * else. The transaction commits on a successful (< 400) response and rolls
 * back otherwise -- Nest's exception filters already write the error
 * response before this ever inspects `res.statusCode`, so throwing here
 * only decides the fate of the transaction, not what the client sees.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextStore,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        await this.tenantContext.run(manager, async () => {
          await new Promise<void>((resolve) => {
            const onDone = () => {
              res.removeListener('finish', onDone);
              res.removeListener('close', onDone);
              resolve();
            };
            res.once('finish', onDone);
            res.once('close', onDone);
            next();
          });
        });

        if (res.statusCode >= 400) {
          throw new Error(
            `Rolling back transaction after a ${res.statusCode} response`,
          );
        }
      });
    } catch (error) {
      if (!res.headersSent) {
        // The request never reached a handler (e.g. the transaction itself
        // failed to open) -- surface it instead of hanging.
        this.logger.error(error);
        res.status(500).json({ statusCode: 500, message: 'Internal server error' });
      }
      // Otherwise this is our own synthetic rollback-trigger error, or an
      // error that Nest already turned into a response -- nothing more to do.
    }
  }
}
