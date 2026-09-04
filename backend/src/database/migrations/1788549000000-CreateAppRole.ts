import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Postgres Row-Level Security has a well-known trap: it does not apply to
 * superusers, and by default does not apply to a table's owner either.
 * The `POSTGRES_USER` the official postgres image bootstraps (`bizflow` in
 * this repo) is created as a superuser, and migrations run as that user
 * (and therefore own every table they create) -- so if the running
 * application also connected as `bizflow`, every RLS policy in this
 * migration set would be silently ignored and the "second, database
 * enforced layer" CLAUDE.md requires would not actually exist.
 *
 * This migration creates a separate, unprivileged `bizflow_app` role for
 * the running application to connect as (see backend/.env.example's
 * DATABASE_URL vs MIGRATION_DATABASE_URL). Migrations keep running as the
 * owner/superuser, which needs the DDL rights this role deliberately does
 * not have.
 */
export class CreateAppRole1788549000000 implements MigrationInterface {
  name = 'CreateAppRole1788549000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bizflow_app') THEN
          CREATE ROLE bizflow_app LOGIN PASSWORD 'bizflow_app_dev_password'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO bizflow_app`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bizflow_app`,
    );
    await queryRunner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bizflow_app`,
    );
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bizflow_app
    `);
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO bizflow_app
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM bizflow_app
    `);
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        REVOKE USAGE, SELECT ON SEQUENCES FROM bizflow_app
    `);
    await queryRunner.query(
      `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM bizflow_app`,
    );
    await queryRunner.query(
      `REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM bizflow_app`,
    );
    await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM bizflow_app`);
    await queryRunner.query(`DROP ROLE IF EXISTS bizflow_app`);
  }
}
