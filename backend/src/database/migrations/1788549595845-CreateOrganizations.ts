import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrganizations1788549595845 implements MigrationInterface {
    name = 'CreateOrganizations1788549595845'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."memberships_role_enum" AS ENUM('owner', 'admin', 'member')`);
        await queryRunner.query(`CREATE TABLE "memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "organization_id" uuid NOT NULL, "role" "public"."memberships_role_enum" NOT NULL DEFAULT 'member', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_membership_user_org" UNIQUE ("user_id", "organization_id"), CONSTRAINT "PK_25d28bd932097a9e90495ede7b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7c1e2fdfed4f6838e0c05ae505" ON "memberships"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e5380c394ec7912046d07b5429" ON "memberships"  ("organization_id") `);
        await queryRunner.query(`CREATE TABLE "organizations" ("id" uuid NOT NULL, "name" character varying NOT NULL, "country_code" character(2) NOT NULL, "base_currency" character(3) NOT NULL, "timezone" character varying NOT NULL DEFAULT 'UTC', "industry" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "organization_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "date_format" character varying NOT NULL DEFAULT 'DD/MM/YYYY', "invoice_number_prefix" character varying NOT NULL DEFAULT '', "invoice_number_next" integer NOT NULL DEFAULT '1', "tax_inclusive_pricing" boolean NOT NULL DEFAULT false, "logo_url" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_5fbdacce9bdcb454877d068e35" UNIQUE ("organization_id"), CONSTRAINT "PK_67a83a1c6256f927137c33ddd7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5fbdacce9bdcb454877d068e35" ON "organization_settings"  ("organization_id") `);
        await queryRunner.query(`ALTER TABLE "organization_settings" ADD CONSTRAINT "FK_5fbdacce9bdcb454877d068e355" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "memberships" ADD CONSTRAINT "FK_memberships_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "memberships" ADD CONSTRAINT "FK_memberships_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // --- Row-Level Security -------------------------------------------
        //
        // `organizations` is visible for a row either matching the request's
        // active org (app.current_org_id, set by OrganizationContextGuard)
        // or one the current user (app.current_user_id, set by JwtAuthGuard)
        // has ANY membership in -- the latter is what lets "list my
        // organizations" / the org switcher work, since that query is
        // inherently cross-tenant for the one user making it. Every other
        // organization-owned table (starting with organization_settings,
        // and every future tenant-scoped table) gets the strict version:
        // visible only within the single currently-active organization.
        await queryRunner.query(`ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`
          CREATE POLICY "organizations_isolation" ON "organizations"
          USING (
            "id"::text = current_setting('app.current_org_id', true)
            OR EXISTS (
              SELECT 1 FROM "memberships" m
              WHERE m."organization_id" = "organizations"."id"
                AND m."user_id"::text = current_setting('app.current_user_id', true)
            )
          )
        `);

        await queryRunner.query(`ALTER TABLE "organization_settings" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "organization_settings" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`
          CREATE POLICY "organization_settings_isolation" ON "organization_settings"
          USING ("organization_id"::text = current_setting('app.current_org_id', true))
        `);

        // Memberships are keyed by the OWNING user, not the active org --
        // a user must be able to see all of their own memberships (across
        // every org they belong to) to discover/switch organizations at
        // all, before any org context has been chosen for the request.
        await queryRunner.query(`ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`
          CREATE POLICY "memberships_isolation" ON "memberships"
          USING ("user_id"::text = current_setting('app.current_user_id', true))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP POLICY "memberships_isolation" ON "memberships"`);
        await queryRunner.query(`DROP POLICY "organization_settings_isolation" ON "organization_settings"`);
        await queryRunner.query(`DROP POLICY "organizations_isolation" ON "organizations"`);

        await queryRunner.query(`ALTER TABLE "memberships" DROP CONSTRAINT "FK_memberships_organization"`);
        await queryRunner.query(`ALTER TABLE "memberships" DROP CONSTRAINT "FK_memberships_user"`);

        await queryRunner.query(`ALTER TABLE "organization_settings" DROP CONSTRAINT "FK_5fbdacce9bdcb454877d068e355"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5fbdacce9bdcb454877d068e35"`);
        await queryRunner.query(`DROP TABLE "organization_settings"`);
        await queryRunner.query(`DROP TABLE "organizations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e5380c394ec7912046d07b5429"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7c1e2fdfed4f6838e0c05ae505"`);
        await queryRunner.query(`DROP TABLE "memberships"`);
        await queryRunner.query(`DROP TYPE "public"."memberships_role_enum"`);
    }

}
