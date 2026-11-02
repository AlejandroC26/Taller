import { MigrationInterface, QueryRunner } from "typeorm";

// Los repuestos se eligen del catálogo de las tiendas: el código pasa a ser el SKU de la
// tienda (hasta 50) y se guarda su tienda e id. El catálogo de códigos universales se va.
// Las columnas se agrandan con ALTER TYPE (el generador las borraba y perdía los datos).
export class RepuestosDeTienda1793457224143 implements MigrationInterface {
    name = 'RepuestosDeTienda1793457224143'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "compras_repuestos" ADD "repuesto_id" character varying(60)`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ADD "tienda" character varying(120) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ADD "repuesto_id" character varying(60) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ADD "marca" character varying(100) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ADD "categoria" character varying(100) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "compras_repuestos" ALTER COLUMN "codigo_repuesto" TYPE character varying(50)`);
        await queryRunner.query(`ALTER TABLE "compras_repuestos" ALTER COLUMN "descripcion" TYPE character varying(200)`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ALTER COLUMN "codigo_repuesto" TYPE character varying(50)`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ALTER COLUMN "descripcion" TYPE character varying(200)`);
        await queryRunner.query(`ALTER TABLE "partes_usadas" ALTER COLUMN "codigo_repuesto" TYPE character varying(50)`);
        await queryRunner.query(`ALTER TABLE "partes_usadas" ALTER COLUMN "descripcion" TYPE character varying(200)`);
        await queryRunner.query(`DROP TABLE "codigos_repuesto"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "codigos_repuesto" ("codigo" character varying(40) NOT NULL, "descripcion" character varying(160) NOT NULL, "sistema" character varying(40) NOT NULL DEFAULT '', CONSTRAINT "PK_de97b8e1b1ef17f449db9894346" PRIMARY KEY ("codigo"))`);
        // Lo que no quepa en los tamaños anteriores se recorta.
        await queryRunner.query(`ALTER TABLE "partes_usadas" ALTER COLUMN "descripcion" TYPE character varying(160) USING left("descripcion", 160)`);
        await queryRunner.query(`ALTER TABLE "partes_usadas" ALTER COLUMN "codigo_repuesto" TYPE character varying(40) USING left("codigo_repuesto", 40)`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ALTER COLUMN "descripcion" TYPE character varying(160) USING left("descripcion", 160)`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ALTER COLUMN "codigo_repuesto" TYPE character varying(40) USING left("codigo_repuesto", 40)`);
        await queryRunner.query(`ALTER TABLE "compras_repuestos" ALTER COLUMN "descripcion" TYPE character varying(160) USING left("descripcion", 160)`);
        await queryRunner.query(`ALTER TABLE "compras_repuestos" ALTER COLUMN "codigo_repuesto" TYPE character varying(40) USING left("codigo_repuesto", 40)`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" DROP COLUMN "categoria"`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" DROP COLUMN "marca"`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" DROP COLUMN "repuesto_id"`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" DROP COLUMN "tienda"`);
        await queryRunner.query(`ALTER TABLE "compras_repuestos" DROP COLUMN "repuesto_id"`);
    }

}
