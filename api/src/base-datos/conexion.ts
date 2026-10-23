import { DataSource } from 'typeorm';
import { noDisponible } from '../comun/errores';
import { Usuario } from '../usuarios/usuario.entity';
import { opcionesBaseDatos } from './opciones';

// Una sola conexión para todo el proceso. Se guarda en globalThis para que la recarga
// en caliente de Next no abra una conexión nueva en cada cambio.
const global = globalThis as { __bdTaller?: Promise<DataSource> };

export async function bd(): Promise<DataSource> {
  const guardada = await global.__bdTaller?.catch(() => null);
  // Con la recarga en caliente las clases cambian: si la conexión guardada no conoce
  // las clases actuales, se rehace.
  if (guardada?.isInitialized && guardada.hasMetadata(Usuario)) return guardada;
  if (guardada?.isInitialized) await guardada.destroy();

  const pendiente = new DataSource(opcionesBaseDatos).initialize();
  global.__bdTaller = pendiente;
  try {
    return await pendiente;
  } catch (error) {
    global.__bdTaller = undefined;
    console.error(error);
    throw noDisponible('No hay conexión con la base de datos');
  }
}
