import type { DataSourceOptions } from 'typeorm';
import { requerida } from '../config';
import { ENTIDADES } from './entidades';

// Una sola configuración para la API, la semilla y los comandos de migración.
// DB_HOST, DB_PUERTO, DB_USUARIO y DB_CLAVE son los del postgres compartido; la base
// del taller es otra (TALLER_DB_NOMBRE).
export const opcionesBaseDatos = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PUERTO ?? 5432),
  username: requerida('DB_USUARIO'),
  password: requerida('DB_CLAVE'),
  database: process.env.TALLER_DB_NOMBRE ?? 'taller',
  entities: ENTIDADES,
  // Las tablas solo cambian con migraciones, nunca de forma automática.
  synchronize: false,
} satisfies DataSourceOptions;
