import { MigrationInterface, QueryRunner } from "typeorm";

export class CatalogoPorCodigo1793473123445 implements MigrationInterface {
    name = 'CatalogoPorCodigo1793473123445'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "compras_repuestos" DROP COLUMN "repuesto_id"`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" DROP COLUMN "tienda"`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" DROP COLUMN "repuesto_id"`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" DROP COLUMN "marca"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ADD "marca" character varying(100) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ADD "repuesto_id" character varying(60) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ADD "tienda" character varying(120) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "compras_repuestos" ADD "repuesto_id" character varying(60)`);
    }

}
