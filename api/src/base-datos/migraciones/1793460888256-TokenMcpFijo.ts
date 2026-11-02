import { MigrationInterface, QueryRunner } from "typeorm";

export class TokenMcpFijo1793460888256 implements MigrationInterface {
    name = 'TokenMcpFijo1793460888256'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "token_mcp_fijo" character varying(120)`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "UQ_ca46af240547e59ea1c6cd0fd48" UNIQUE ("token_mcp_fijo")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "UQ_ca46af240547e59ea1c6cd0fd48"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "token_mcp_fijo"`);
    }

}
