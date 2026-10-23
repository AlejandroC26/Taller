import type { EntityManager } from 'typeorm';
import { EventoIntegracion } from './evento.entity';
import type { Destino } from './evento.entity';

// Deja un mensaje para otro proyecto dentro de la misma transacción del cambio: o se
// guardan los dos, o ninguno.
export async function encolar(
  tx: EntityManager,
  destino: Destino,
  herramienta: string,
  datos: Record<string, unknown>,
) {
  await tx.save(tx.create(EventoIntegracion, { destino, herramienta, datos }));
}

// Avisa al despachador que hay eventos nuevos. Espera un momento para que la
// transacción ya esté confirmada; si algo queda pendiente, se envía en el próximo
// aviso o con POST /api/integraciones/reintentar.
let temporizador: ReturnType<typeof setTimeout> | undefined;
export function avisarDespacho(espera = 800) {
  if (process.env.VITEST) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    import('./despachador')
      .then((m) => m.despachar())
      .catch((error) => console.error('Despacho de integraciones:', error));
  }, espera);
}
