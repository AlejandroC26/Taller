import { MigrationInterface, QueryRunner } from "typeorm";

export class EventoDescartado1793848176484 implements MigrationInterface {
    name = 'EventoDescartado1793848176484'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."eventos_integracion_estado_enum" ADD VALUE 'descartado'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Sin el estado nuevo, lo descartado vuelve a desactivado (tampoco se envía solo).
        await queryRunner.query(`UPDATE "eventos_integracion" SET "estado" = 'desactivado' WHERE "estado" = 'descartado'`);
        await queryRunner.query(`CREATE TYPE "public"."eventos_integracion_estado_enum_old" AS ENUM('pendiente', 'enviado', 'fallido', 'desactivado')`);
        await queryRunner.query(`ALTER TABLE "eventos_integracion" ALTER COLUMN "estado" TYPE "public"."eventos_integracion_estado_enum_old" USING "estado"::"text"::"public"."eventos_integracion_estado_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."eventos_integracion_estado_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."eventos_integracion_estado_enum_old" RENAME TO "eventos_integracion_estado_enum"`);
    }

}
