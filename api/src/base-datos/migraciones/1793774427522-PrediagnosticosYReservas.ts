import { MigrationInterface, QueryRunner } from "typeorm";

export class PrediagnosticosYReservas1793774427522 implements MigrationInterface {
    name = 'PrediagnosticosYReservas1793774427522'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "prediagnosticos" ("id" SERIAL NOT NULL, "resultado" jsonb NOT NULL, "mensajes_cliente" jsonb NOT NULL DEFAULT '[]', "por_garantia" boolean NOT NULL DEFAULT false, "motivo_reclamo" text, "kilometraje" integer, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_relacion" character varying(60) NOT NULL, "taller_id" integer, CONSTRAINT "PK_65b6d5aa2258852ac1b42485ecb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reservas_franja" ("id" SERIAL NOT NULL, "fecha_hora" TIMESTAMP WITH TIME ZONE NOT NULL, "vence_en" TIMESTAMP WITH TIME ZONE NOT NULL, "usada" boolean NOT NULL DEFAULT false, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "taller_id" integer NOT NULL, "id_relacion" character varying(60) NOT NULL, CONSTRAINT "PK_61aafe37e96d4874456788b04c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "prediagnosticos" ADD CONSTRAINT "FK_450766bb608c336faffc89378da" FOREIGN KEY ("id_relacion") REFERENCES "relaciones_vehiculo"("id_relacion") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prediagnosticos" ADD CONSTRAINT "FK_687d25f40740f928cc76977d298" FOREIGN KEY ("taller_id") REFERENCES "talleres"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservas_franja" ADD CONSTRAINT "FK_b42436270229bee400b7cadce83" FOREIGN KEY ("taller_id") REFERENCES "talleres"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservas_franja" ADD CONSTRAINT "FK_bc807bb818f9db9702987ac1684" FOREIGN KEY ("id_relacion") REFERENCES "relaciones_vehiculo"("id_relacion") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservas_franja" DROP CONSTRAINT "FK_bc807bb818f9db9702987ac1684"`);
        await queryRunner.query(`ALTER TABLE "reservas_franja" DROP CONSTRAINT "FK_b42436270229bee400b7cadce83"`);
        await queryRunner.query(`ALTER TABLE "prediagnosticos" DROP CONSTRAINT "FK_687d25f40740f928cc76977d298"`);
        await queryRunner.query(`ALTER TABLE "prediagnosticos" DROP CONSTRAINT "FK_450766bb608c336faffc89378da"`);
        await queryRunner.query(`DROP TABLE "reservas_franja"`);
        await queryRunner.query(`DROP TABLE "prediagnosticos"`);
    }

}
