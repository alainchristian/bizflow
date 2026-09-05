import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCatalogItems1788587645099 implements MigrationInterface {
    name = 'CreateCatalogItems1788587645099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."catalog_items_type_enum" AS ENUM('product', 'service')`);
        await queryRunner.query(`CREATE TABLE "catalog_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "description" character varying, "type" "public"."catalog_items_type_enum" NOT NULL, "price_amount" bigint NOT NULL, "currency_code" character(3) NOT NULL, "sku" character varying, "is_active" boolean NOT NULL DEFAULT true, "tax_rule_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dd1c29828c10a599d894b9b6535" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_73c3b56aee3409b308ab87f1a3" ON "catalog_items"  ("organization_id") `);

        await queryRunner.query(`ALTER TABLE "catalog_items" ADD CONSTRAINT "FK_catalog_items_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // --- Row-Level Security ---------------------------------------------
        // Same strict single-org convention as the CRM tables (Step 5) -- see
        // that migration's comment for the rationale.
        await queryRunner.query(`ALTER TABLE "catalog_items" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "catalog_items" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`
          CREATE POLICY "catalog_items_isolation" ON "catalog_items"
          USING ("organization_id"::text = current_setting('app.current_org_id', true))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP POLICY "catalog_items_isolation" ON "catalog_items"`);
        await queryRunner.query(`ALTER TABLE "catalog_items" DROP CONSTRAINT "FK_catalog_items_organization"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_73c3b56aee3409b308ab87f1a3"`);
        await queryRunner.query(`DROP TABLE "catalog_items"`);
        await queryRunner.query(`DROP TYPE "public"."catalog_items_type_enum"`);
    }

}
