import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInvitationExpiry1788556107798 implements MigrationInterface {
    name = 'AddInvitationExpiry1788556107798'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invitations" ADD "expires_at" TIMESTAMP NOT NULL DEFAULT (now() + interval '7 days')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invitations" DROP COLUMN "expires_at"`);
    }

}
