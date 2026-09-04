import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInvitations1788554058164 implements MigrationInterface {
    name = 'CreateInvitations1788554058164'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."invitations_role_enum" AS ENUM('owner', 'admin', 'member')`);
        await queryRunner.query(`CREATE TYPE "public"."invitations_status_enum" AS ENUM('pending', 'accepted', 'revoked')`);
        await queryRunner.query(`CREATE TABLE "invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "email" character varying NOT NULL, "role" "public"."invitations_role_enum" NOT NULL DEFAULT 'member', "invited_by_user_id" uuid NOT NULL, "status" "public"."invitations_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5dec98cfdfd562e4ad3648bbb07" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_42d1dbb4d85dc3643fdc6560af" ON "invitations"  ("organization_id") `);
        await queryRunner.query(`ALTER TABLE "invitations" ADD CONSTRAINT "FK_invitations_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invitations" ADD CONSTRAINT "FK_invitations_invited_by" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // --- Row-Level Security ---------------------------------------------
        //
        // invitations is visible either within the currently-active org
        // (app.current_org_id -- the "manage my team's invitations" case,
        // strict like organization_settings) OR to whoever it was addressed
        // to (matched against the authenticated caller's own email via
        // app.current_user_id -- the "accept my invitation" case, where the
        // caller has no relationship to that org yet, so current_org_id can
        // never be set to it). The email branch derives the caller's email
        // from `users` (which has no RLS of its own) rather than adding a
        // third session variable.
        await queryRunner.query(`ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`
          CREATE POLICY "invitations_isolation" ON "invitations"
          USING (
            "organization_id"::text = current_setting('app.current_org_id', true)
            OR "email" = (
              SELECT "email" FROM "users"
              WHERE "id"::text = current_setting('app.current_user_id', true)
            )
          )
        `);

        // memberships originally allowed a row only via app.current_user_id
        // (its own row) or, through the organizations table's policy, the
        // implicit trust of the EXISTS check there. Step 4's "list my
        // organization's team" needs to see OTHER users' membership rows
        // too, which that never covered -- widen it the same way
        // `organizations` already is: your own rows (any org), or every row
        // in the currently-active org.
        await queryRunner.query(`
          ALTER POLICY "memberships_isolation" ON "memberships"
          USING (
            "user_id"::text = current_setting('app.current_user_id', true)
            OR "organization_id"::text = current_setting('app.current_org_id', true)
          )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER POLICY "memberships_isolation" ON "memberships"
          USING ("user_id"::text = current_setting('app.current_user_id', true))
        `);

        await queryRunner.query(`DROP POLICY "invitations_isolation" ON "invitations"`);

        await queryRunner.query(`ALTER TABLE "invitations" DROP CONSTRAINT "FK_invitations_invited_by"`);
        await queryRunner.query(`ALTER TABLE "invitations" DROP CONSTRAINT "FK_invitations_organization"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_42d1dbb4d85dc3643fdc6560af"`);
        await queryRunner.query(`DROP TABLE "invitations"`);
        await queryRunner.query(`DROP TYPE "public"."invitations_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."invitations_role_enum"`);
    }

}
