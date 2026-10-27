import { bd } from '../base-datos/conexion';
import { MensajeRecibido } from './mensaje-recibido.entity';

// Si otro agente repite una llamada con el mismo id_mensaje (un reintento tras un corte),
// se devuelve lo mismo que la primera vez, sin repetir el cambio. Sin id_mensaje, la
// llamada se procesa siempre.
export async function unaVez<T>(idMensaje: string | undefined, herramienta: string, accion: () => Promise<T>): Promise<T> {
  if (!idMensaje) return accion();
  const repo = (await bd()).getRepository(MensajeRecibido);
  const previo = await repo.findOneBy({ idMensaje });
  if (previo) return previo.resultado as T;
  const resultado = await accion();
  try {
    await repo.insert({ idMensaje, herramienta, resultado: resultado as object });
  } catch {
    // Otro proceso lo registró al mismo tiempo: no pasa nada.
  }
  return resultado;
}
