import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

/**
 * Directly updates a timestamp column on a tenant-owned row, bypassing the
 * app entirely -- for tests that need to simulate time passing (e.g. "this
 * invitation has expired") without actually waiting or adding a test-only
 * backdoor to production code.
 *
 * A plain `dataSource.query(...)` won't work here: the app's `DataSource`
 * connects as the RLS-restricted `bizflow_app` role (see
 * docs/multi-tenancy/tenant-isolation.md), and an ad-hoc query has no
 * `app.current_org_id`/`app.current_user_id` session variables set, so RLS
 * would silently match zero rows. This opens one `QueryRunner` (a single
 * pinned connection) and sets both session variables on it, session-wide
 * (`is_local: false`, since there's no transaction here to scope a `true`
 * to), before running the update on that same connection.
 */
export async function backdateColumn(
  app: INestApplication<App>,
  options: {
    table: string;
    column: string;
    id: string;
    organizationId: string;
    userId: string;
    value: Date;
  },
): Promise<void> {
  const dataSource = app.get(DataSource);
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    await queryRunner.query("SELECT set_config('app.current_org_id', $1, false)", [
      options.organizationId,
    ]);
    await queryRunner.query("SELECT set_config('app.current_user_id', $1, false)", [
      options.userId,
    ]);
    await queryRunner.query(
      `UPDATE "${options.table}" SET "${options.column}" = $1 WHERE id = $2`,
      [options.value, options.id],
    );
  } finally {
    await queryRunner.release();
  }
}
