import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { RAIZ } from '../config';
import { opcionesBaseDatos } from './opciones';

// La usan los comandos npm run migracion:generar, migracion:correr y
// migracion:revertir. Solo aquí se cargan las migraciones: la API no las necesita.
export default new DataSource({
  ...opcionesBaseDatos,
  migrations: [join(RAIZ, 'src', 'base-datos', 'migraciones', '*.ts')],
});
