import { DataSource } from 'typeorm';
import { noDisponible } from '../comun/errores';
import { ENTIDADES } from './entidades';
import { opcionesBaseDatos } from './opciones';

// Una conexión por versión de las entidades, guardada en globalThis. En producción hay una
// sola. Con la recarga en caliente de Next, las rutas recompiladas traen clases nuevas
// mientras otras siguen con las viejas: cada grupo usa la conexión que conoce sus clases,
// sin cerrar la de los demás (cerrarla dejaba sus consultas colgadas). El pool viejo suelta
// solo sus conexiones inactivas.
const global = globalThis as { __conexionesTaller?: WeakMap<object, Promise<DataSource>> };

export async function bd(): Promise<DataSource> {
  const conexiones = (global.__conexionesTaller ??= new WeakMap());
  const guardada = conexiones.get(ENTIDADES);
  if (guardada) return guardada;

  const pendiente = new DataSource(opcionesBaseDatos).initialize();
  conexiones.set(ENTIDADES, pendiente);
  try {
    return await pendiente;
  } catch (error) {
    conexiones.delete(ENTIDADES);
    console.error(error);
    throw noDisponible('No hay conexión con la base de datos');
  }
}
