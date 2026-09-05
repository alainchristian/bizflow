import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTaxRules1788588777066 implements MigrationInterface {
    name = 'CreateTaxRules1788588777066'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tax_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "rate_basis_points" integer NOT NULL, "is_inclusive" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_29b500604ee0ac9e162de1bfa6d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ac362dd7de7f01674934194817" ON "tax_rules"  ("organization_id") `);

        await queryRunner.query(`ALTER TABLE "tax_rules" ADD CONSTRAINT "FK_tax_rules_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // catalog_items.tax_rule_id was added as a bare nullable column in
        // Step 6, unpopulated until this table existed to reference.
        await queryRunner.query(`ALTER TABLE "catalog_items" ADD CONSTRAINT "FK_catalog_items_tax_rule" FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // --- Row-Level Security ---------------------------------------------
        // Same strict single-org convention as every other tenant table.
        await queryRunner.query(`ALTER TABLE "tax_rules" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "tax_rules" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`
          CREATE POLICY "tax_rules_isolation" ON "tax_rules"
          USING ("organization_id"::text = current_setting('app.current_org_id', true))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP POLICY "tax_rules_isolation" ON "tax_rules"`);
        await queryRunner.query(`ALTER TABLE "catalog_items" DROP CONSTRAINT "FK_catalog_items_tax_rule"`);
        await queryRunner.query(`ALTER TABLE "tax_rules" DROP CONSTRAINT "FK_tax_rules_organization"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ac362dd7de7f01674934194817"`);
        await queryRunner.query(`DROP TABLE "tax_rules"`);
    }

}
