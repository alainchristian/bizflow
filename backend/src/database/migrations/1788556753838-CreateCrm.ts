import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCrm1788556753838 implements MigrationInterface {
    name = 'CreateCrm1788556753838'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."leads_status_enum" AS ENUM('new', 'contacted', 'qualified', 'converted', 'lost')`);
        await queryRunner.query(`CREATE TABLE "leads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "full_name" character varying NOT NULL, "company_name" character varying, "email" character varying, "phone" character varying, "source" character varying, "status" "public"."leads_status_enum" NOT NULL DEFAULT 'new', "assigned_to_user_id" uuid, "converted_customer_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3e1b3f24e7d9a8d07c586ace1b" ON "leads"  ("organization_id") `);

        await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "email" character varying, "phone" character varying, "converted_from_lead_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d2fc0e42b07d01fafc3fbb2bee" ON "customers"  ("organization_id") `);

        await queryRunner.query(`CREATE TABLE "contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "full_name" character varying NOT NULL, "email" character varying, "phone" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b99cd40cfd66a99f1571f4f72e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0799185e89f0eec8f7ec05a5bb" ON "contacts"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3857e3d5137fea5865651a1be7" ON "contacts"  ("customer_id") `);

        await queryRunner.query(`CREATE TABLE "customer_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "author_user_id" uuid NOT NULL, "body" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8a41bce1fe0094bd7a9c5266cc8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_39a24f2c7d43d57ff5db923df8" ON "customer_notes"  ("organization_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b77784184daa7589018ac4e840" ON "customer_notes"  ("customer_id") `);

        // Foreign keys. The two cross-links between leads and customers are
        // both nullable and RESTRICT (never cascade-delete business data,
        // per CLAUDE.md's money/financial-data rule extended here since
        // there's no delete path for either yet anyway).
        await queryRunner.query(`ALTER TABLE "leads" ADD CONSTRAINT "FK_leads_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leads" ADD CONSTRAINT "FK_leads_assigned_to" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leads" ADD CONSTRAINT "FK_leads_converted_customer" FOREIGN KEY ("converted_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "customers" ADD CONSTRAINT "FK_customers_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "customers" ADD CONSTRAINT "FK_customers_converted_from_lead" FOREIGN KEY ("converted_from_lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD CONSTRAINT "FK_contacts_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD CONSTRAINT "FK_contacts_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "customer_notes" ADD CONSTRAINT "FK_customer_notes_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "customer_notes" ADD CONSTRAINT "FK_customer_notes_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "customer_notes" ADD CONSTRAINT "FK_customer_notes_author" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // --- Row-Level Security ---------------------------------------------
        //
        // All four tables follow the strict convention (organization_settings,
        // Step 3): visible only within the single currently-active
        // organization, no cross-org carve-out. Unlike `organizations` or
        // `memberships`, there is no legitimate reason for a request to see
        // CRM data outside its resolved org context -- everything here is
        // read/written only via TenantScopedRepository, always after
        // OrganizationContextGuard has set app.current_org_id.
        for (const table of ['leads', 'customers', 'contacts', 'customer_notes']) {
          await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
          await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
          await queryRunner.query(`
            CREATE POLICY "${table}_isolation" ON "${table}"
            USING ("organization_id"::text = current_setting('app.current_org_id', true))
          `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const table of ['customer_notes', 'contacts', 'customers', 'leads']) {
          await queryRunner.query(`DROP POLICY "${table}_isolation" ON "${table}"`);
        }

        await queryRunner.query(`ALTER TABLE "customer_notes" DROP CONSTRAINT "FK_customer_notes_author"`);
        await queryRunner.query(`ALTER TABLE "customer_notes" DROP CONSTRAINT "FK_customer_notes_customer"`);
        await queryRunner.query(`ALTER TABLE "customer_notes" DROP CONSTRAINT "FK_customer_notes_organization"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP CONSTRAINT "FK_contacts_customer"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP CONSTRAINT "FK_contacts_organization"`);
        await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_customers_converted_from_lead"`);
        await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_customers_organization"`);
        await queryRunner.query(`ALTER TABLE "leads" DROP CONSTRAINT "FK_leads_converted_customer"`);
        await queryRunner.query(`ALTER TABLE "leads" DROP CONSTRAINT "FK_leads_assigned_to"`);
        await queryRunner.query(`ALTER TABLE "leads" DROP CONSTRAINT "FK_leads_organization"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_b77784184daa7589018ac4e840"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_39a24f2c7d43d57ff5db923df8"`);
        await queryRunner.query(`DROP TABLE "customer_notes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3857e3d5137fea5865651a1be7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0799185e89f0eec8f7ec05a5bb"`);
        await queryRunner.query(`DROP TABLE "contacts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d2fc0e42b07d01fafc3fbb2bee"`);
        await queryRunner.query(`DROP TABLE "customers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3e1b3f24e7d9a8d07c586ace1b"`);
        await queryRunner.query(`DROP TABLE "leads"`);
        await queryRunner.query(`DROP TYPE "public"."leads_status_enum"`);
    }

}
