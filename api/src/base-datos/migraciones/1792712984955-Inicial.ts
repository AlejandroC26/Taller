import { MigrationInterface, QueryRunner } from "typeorm";

export class Inicial1792712984955 implements MigrationInterface {
    name = 'Inicial1792712984955'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."vehiculos_origen_enum" AS ENUM('taller', 'concesionario')`);
        await queryRunner.query(`CREATE TABLE "vehiculos" ("id" SERIAL NOT NULL, "placa" character varying(10) NOT NULL, "marca" character varying(40) NOT NULL, "modelo" character varying(60) NOT NULL, "anio" integer NOT NULL, "color" character varying(30) NOT NULL DEFAULT '', "kilometraje" integer NOT NULL DEFAULT '0', "origen" "public"."vehiculos_origen_enum" NOT NULL DEFAULT 'taller', "referencia_externa" character varying(80), "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cliente_id" integer NOT NULL, CONSTRAINT "UQ_a9455f3a37d1d922a10f51664e9" UNIQUE ("placa"), CONSTRAINT "UQ_367d8e6134c0ed67a757fec2f18" UNIQUE ("referencia_externa"), CONSTRAINT "PK_bc0b75baae377e599cd46b502e1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "clientes" ("id" SERIAL NOT NULL, "nombre" character varying(80) NOT NULL, "apellido" character varying(80) NOT NULL, "documento" character varying(20) NOT NULL, "telefono" character varying(20) NOT NULL, "correo" character varying(150), "direccion" character varying(200), "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_fc002853c86bd15f82ef93bf42a" UNIQUE ("documento"), CONSTRAINT "PK_d76bf3571d906e4e86470482c08" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "roles" ("id" SERIAL NOT NULL, "nombre" character varying(40) NOT NULL, "descripcion" character varying(200) NOT NULL DEFAULT '', CONSTRAINT "UQ_a5be7aa67e759e347b1c6464e10" UNIQUE ("nombre"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(80) NOT NULL, "apellido" character varying(80) NOT NULL, "documento" character varying(20) NOT NULL, "telefono" character varying(20) NOT NULL, "usuario" character varying(40) NOT NULL, "clave_hash" character varying(200) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "rol_id" integer NOT NULL, CONSTRAINT "UQ_604e2077971f192d85cffb5c437" UNIQUE ("documento"), CONSTRAINT "UQ_0790a401b9d234fa921e9aa1777" UNIQUE ("usuario"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."asignaciones_etapa_enum" AS ENUM('diagnostico', 'reparacion')`);
        await queryRunner.query(`CREATE TABLE "asignaciones" ("id" SERIAL NOT NULL, "etapa" "public"."asignaciones_etapa_enum" NOT NULL, "activa" boolean NOT NULL DEFAULT true, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orden_id" integer NOT NULL, "mecanico_id" uuid NOT NULL, "asignado_por" uuid NOT NULL, CONSTRAINT "PK_6c11ab1a82249192bc2e2763d3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."ordenes_estado_enum" AS ENUM('recibido', 'en_diagnostico', 'diagnosticado', 'aprobado', 'en_reparacion', 'terminado', 'entregado', 'cancelado')`);
        await queryRunner.query(`CREATE TYPE "public"."ordenes_origen_enum" AS ENUM('taller', 'concesionario')`);
        await queryRunner.query(`CREATE TABLE "ordenes" ("id" SERIAL NOT NULL, "motivo" text NOT NULL, "kilometraje" integer, "estado" "public"."ordenes_estado_enum" NOT NULL DEFAULT 'recibido', "motivo_cancelacion" text, "origen" "public"."ordenes_origen_enum" NOT NULL DEFAULT 'taller', "historial" jsonb NOT NULL DEFAULT '[]', "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "vehiculo_id" integer NOT NULL, "creada_por" uuid NOT NULL, CONSTRAINT "PK_58713affeb8e3b7b30b9eeeee7a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "categorias" ("id" SERIAL NOT NULL, "nombre" character varying(60) NOT NULL, CONSTRAINT "UQ_ccdf6cd1a34ea90a7233325063d" UNIQUE ("nombre"), CONSTRAINT "PK_3886a26251605c571c6b4f861fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "items" ("id" SERIAL NOT NULL, "codigo" character varying(40) NOT NULL, "nombre" character varying(120) NOT NULL, "precio" numeric(12,2) NOT NULL, "cantidad" integer NOT NULL DEFAULT '0', "nivel_alerta" integer NOT NULL DEFAULT '0', "activo" boolean NOT NULL DEFAULT true, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "categoria_id" integer NOT NULL, CONSTRAINT "UQ_9646ce9b9089c1965ea1f01073d" UNIQUE ("codigo"), CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "diagnostico_repuestos" ("id" SERIAL NOT NULL, "descripcion" character varying(160) NOT NULL, "cantidad" integer NOT NULL, "precio_unitario" numeric(12,2) NOT NULL, "tarea_id" integer NOT NULL, "item_id" integer, CONSTRAINT "PK_1c38eb74537fa69b75856524fa1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "diagnostico_tareas" ("id" SERIAL NOT NULL, "posicion" integer NOT NULL, "descripcion" text NOT NULL, "horas_estimadas" numeric(6,2) NOT NULL, "valor_servicio" numeric(12,2) NOT NULL DEFAULT '0', "requiere_piezas" boolean NOT NULL DEFAULT false, "completada" boolean NOT NULL DEFAULT false, "diagnostico_id" integer NOT NULL, CONSTRAINT "PK_9330f93b918f789a009d47b2601" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."diagnosticos_estado_enum" AS ENUM('borrador', 'finalizado', 'cancelado')`);
        await queryRunner.query(`CREATE TABLE "diagnosticos" ("id" SERIAL NOT NULL, "observaciones" text NOT NULL DEFAULT '', "tarifa_hora" numeric(12,2) NOT NULL, "estado" "public"."diagnosticos_estado_enum" NOT NULL DEFAULT 'borrador', "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "finalizado_en" TIMESTAMP WITH TIME ZONE, "orden_id" integer NOT NULL, "mecanico_id" uuid NOT NULL, CONSTRAINT "REL_9b606a138edcf6f47747248654" UNIQUE ("orden_id"), CONSTRAINT "PK_d8400650a85355bdd4ada0f0c5a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."eventos_integracion_destino_enum" AS ENUM('partes', 'facturacion', 'concesionario')`);
        await queryRunner.query(`CREATE TYPE "public"."eventos_integracion_estado_enum" AS ENUM('pendiente', 'enviado', 'fallido', 'desactivado')`);
        await queryRunner.query(`CREATE TABLE "eventos_integracion" ("id" SERIAL NOT NULL, "destino" "public"."eventos_integracion_destino_enum" NOT NULL, "herramienta" character varying(60) NOT NULL, "datos" jsonb NOT NULL, "estado" "public"."eventos_integracion_estado_enum" NOT NULL DEFAULT 'pendiente', "intentos" integer NOT NULL DEFAULT '0', "ultimo_error" text, "respuesta" text, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "enviado_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a52ffd3854f54ad45280f2d5839" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."movimientos_inventario_tipo_enum" AS ENUM('entrada', 'salida', 'ajuste')`);
        await queryRunner.query(`CREATE TABLE "movimientos_inventario" ("id" SERIAL NOT NULL, "tipo" "public"."movimientos_inventario_tipo_enum" NOT NULL, "cantidad" integer NOT NULL, "saldo" integer NOT NULL, "nota" character varying(200) NOT NULL DEFAULT '', "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "item_id" integer NOT NULL, "orden_id" integer, "usuario_id" uuid NOT NULL, CONSTRAINT "PK_812f6e4f95b017981363c4b9ff9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "registros_horas" ("id" SERIAL NOT NULL, "inicio" TIMESTAMP WITH TIME ZONE NOT NULL, "fin" TIMESTAMP WITH TIME ZONE NOT NULL, "horas" numeric(6,2) NOT NULL, "nota" character varying(300) NOT NULL DEFAULT '', "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reparacion_id" integer NOT NULL, "mecanico_id" uuid NOT NULL, "tarea_id" integer, CONSTRAINT "PK_b7d83d7f122bd3806a868c4826f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."reparaciones_estado_enum" AS ENUM('en_curso', 'terminada', 'cancelada')`);
        await queryRunner.query(`CREATE TABLE "reparaciones" ("id" SERIAL NOT NULL, "estado" "public"."reparaciones_estado_enum" NOT NULL DEFAULT 'en_curso', "iniciada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "terminada_en" TIMESTAMP WITH TIME ZONE, "total" numeric(14,2), "orden_id" integer NOT NULL, CONSTRAINT "REL_e40ef514db6e38f13a388b36bd" UNIQUE ("orden_id"), CONSTRAINT "PK_f140249d410849757959b39b185" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "partes_usadas" ("id" SERIAL NOT NULL, "cantidad" integer NOT NULL, "precio_unitario" numeric(12,2) NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reparacion_id" integer NOT NULL, "item_id" integer NOT NULL, "registrada_por" uuid NOT NULL, CONSTRAINT "PK_ec5b93206d810947bd9746fde95" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "vehiculos" ADD CONSTRAINT "FK_46e4b6b1f8806acb275970ccacc" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "FK_9e519760a660751f4fa21453d3e" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asignaciones" ADD CONSTRAINT "FK_04527f8ba3651e13e01e2b2ea7c" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asignaciones" ADD CONSTRAINT "FK_7dd4679c05c347884c7418eb5b0" FOREIGN KEY ("mecanico_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asignaciones" ADD CONSTRAINT "FK_cf6225544ac91ed41022ae1808c" FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ordenes" ADD CONSTRAINT "FK_2fe3a0b6b47ce4161610419513f" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ordenes" ADD CONSTRAINT "FK_0e0f896e8963cecf856c14f07fe" FOREIGN KEY ("creada_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "items" ADD CONSTRAINT "FK_d28eabc42dca67281229c8bdaba" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ADD CONSTRAINT "FK_e85081febb108409b83a6162297" FOREIGN KEY ("tarea_id") REFERENCES "diagnostico_tareas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" ADD CONSTRAINT "FK_4b01f279b90ae6e9b4bc98eba3d" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "diagnostico_tareas" ADD CONSTRAINT "FK_4ed6f687f17f475131afd239eaf" FOREIGN KEY ("diagnostico_id") REFERENCES "diagnosticos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "diagnosticos" ADD CONSTRAINT "FK_9b606a138edcf6f47747248654e" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "diagnosticos" ADD CONSTRAINT "FK_f88b5e42afae216b1cbe21aa489" FOREIGN KEY ("mecanico_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "FK_db62306ddb3638d2b4fdd101165" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "FK_24489cb6e17cd867fd73682619c" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "FK_c86769588f51c7bbb6bf78ca32b" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registros_horas" ADD CONSTRAINT "FK_d55d3eda9b9f1478a285486d181" FOREIGN KEY ("reparacion_id") REFERENCES "reparaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registros_horas" ADD CONSTRAINT "FK_d1bf93ed8359a842965428d376c" FOREIGN KEY ("mecanico_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registros_horas" ADD CONSTRAINT "FK_a65c124fce36aafebc34bf1c0c1" FOREIGN KEY ("tarea_id") REFERENCES "diagnostico_tareas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reparaciones" ADD CONSTRAINT "FK_e40ef514db6e38f13a388b36bd6" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "partes_usadas" ADD CONSTRAINT "FK_f0086a8c5df73f12be2af43cd24" FOREIGN KEY ("reparacion_id") REFERENCES "reparaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "partes_usadas" ADD CONSTRAINT "FK_9498addcb0d107c705b75bd4f1f" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "partes_usadas" ADD CONSTRAINT "FK_228a943c213dc790567720348b4" FOREIGN KEY ("registrada_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "partes_usadas" DROP CONSTRAINT "FK_228a943c213dc790567720348b4"`);
        await queryRunner.query(`ALTER TABLE "partes_usadas" DROP CONSTRAINT "FK_9498addcb0d107c705b75bd4f1f"`);
        await queryRunner.query(`ALTER TABLE "partes_usadas" DROP CONSTRAINT "FK_f0086a8c5df73f12be2af43cd24"`);
        await queryRunner.query(`ALTER TABLE "reparaciones" DROP CONSTRAINT "FK_e40ef514db6e38f13a388b36bd6"`);
        await queryRunner.query(`ALTER TABLE "registros_horas" DROP CONSTRAINT "FK_a65c124fce36aafebc34bf1c0c1"`);
        await queryRunner.query(`ALTER TABLE "registros_horas" DROP CONSTRAINT "FK_d1bf93ed8359a842965428d376c"`);
        await queryRunner.query(`ALTER TABLE "registros_horas" DROP CONSTRAINT "FK_d55d3eda9b9f1478a285486d181"`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "FK_c86769588f51c7bbb6bf78ca32b"`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "FK_24489cb6e17cd867fd73682619c"`);
        await queryRunner.query(`ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "FK_db62306ddb3638d2b4fdd101165"`);
        await queryRunner.query(`ALTER TABLE "diagnosticos" DROP CONSTRAINT "FK_f88b5e42afae216b1cbe21aa489"`);
        await queryRunner.query(`ALTER TABLE "diagnosticos" DROP CONSTRAINT "FK_9b606a138edcf6f47747248654e"`);
        await queryRunner.query(`ALTER TABLE "diagnostico_tareas" DROP CONSTRAINT "FK_4ed6f687f17f475131afd239eaf"`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" DROP CONSTRAINT "FK_4b01f279b90ae6e9b4bc98eba3d"`);
        await queryRunner.query(`ALTER TABLE "diagnostico_repuestos" DROP CONSTRAINT "FK_e85081febb108409b83a6162297"`);
        await queryRunner.query(`ALTER TABLE "items" DROP CONSTRAINT "FK_d28eabc42dca67281229c8bdaba"`);
        await queryRunner.query(`ALTER TABLE "ordenes" DROP CONSTRAINT "FK_0e0f896e8963cecf856c14f07fe"`);
        await queryRunner.query(`ALTER TABLE "ordenes" DROP CONSTRAINT "FK_2fe3a0b6b47ce4161610419513f"`);
        await queryRunner.query(`ALTER TABLE "asignaciones" DROP CONSTRAINT "FK_cf6225544ac91ed41022ae1808c"`);
        await queryRunner.query(`ALTER TABLE "asignaciones" DROP CONSTRAINT "FK_7dd4679c05c347884c7418eb5b0"`);
        await queryRunner.query(`ALTER TABLE "asignaciones" DROP CONSTRAINT "FK_04527f8ba3651e13e01e2b2ea7c"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "FK_9e519760a660751f4fa21453d3e"`);
        await queryRunner.query(`ALTER TABLE "vehiculos" DROP CONSTRAINT "FK_46e4b6b1f8806acb275970ccacc"`);
        await queryRunner.query(`DROP TABLE "partes_usadas"`);
        await queryRunner.query(`DROP TABLE "reparaciones"`);
        await queryRunner.query(`DROP TYPE "public"."reparaciones_estado_enum"`);
        await queryRunner.query(`DROP TABLE "registros_horas"`);
        await queryRunner.query(`DROP TABLE "movimientos_inventario"`);
        await queryRunner.query(`DROP TYPE "public"."movimientos_inventario_tipo_enum"`);
        await queryRunner.query(`DROP TABLE "eventos_integracion"`);
        await queryRunner.query(`DROP TYPE "public"."eventos_integracion_estado_enum"`);
        await queryRunner.query(`DROP TYPE "public"."eventos_integracion_destino_enum"`);
        await queryRunner.query(`DROP TABLE "diagnosticos"`);
        await queryRunner.query(`DROP TYPE "public"."diagnosticos_estado_enum"`);
        await queryRunner.query(`DROP TABLE "diagnostico_tareas"`);
        await queryRunner.query(`DROP TABLE "diagnostico_repuestos"`);
        await queryRunner.query(`DROP TABLE "items"`);
        await queryRunner.query(`DROP TABLE "categorias"`);
        await queryRunner.query(`DROP TABLE "ordenes"`);
        await queryRunner.query(`DROP TYPE "public"."ordenes_origen_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ordenes_estado_enum"`);
        await queryRunner.query(`DROP TABLE "asignaciones"`);
        await queryRunner.query(`DROP TYPE "public"."asignaciones_etapa_enum"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP TABLE "clientes"`);
        await queryRunner.query(`DROP TABLE "vehiculos"`);
        await queryRunner.query(`DROP TYPE "public"."vehiculos_origen_enum"`);
    }

}
