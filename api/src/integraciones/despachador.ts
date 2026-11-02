import { In } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { CONTRATO, configuracion } from './contrato';
import { llamarHerramienta, SinConexion } from './conector-mcp';
import { DESTINOS, EventoIntegracion } from './evento.entity';
import type { Destino } from './evento.entity';

export const MAXIMO_INTENTOS = 5;
// Facturación tarda de 20 a 35 s en dar el acuse de crear_cotizacion (le pregunta a la
// tienda antes de responder). La bandeja trabaja en segundo plano: se le da margen.
export const TIEMPO_ENVIO_MS = 90_000;

export type CambioEvento = Partial<Pick<EventoIntegracion, 'estado' | 'intentos' | 'enviadoEn' | 'ultimoError' | 'respuesta'>>;

type Llamar = (destino: Destino, herramienta: string, datos: Record<string, unknown>, tiempoMs?: number) => Promise<unknown>;

// El mismo en cada reintento del evento: así el otro sistema no lo procesa dos veces.
export const idMensajeDe = (evento: Pick<EventoIntegracion, 'id' | 'herramienta'>) => `taller-${evento.id}-${evento.herramienta}`;

// Qué le pasa a un evento después de un intento de envío. Sin MCP configurado queda
// desactivado (no es un error: el otro proyecto todavía no existe).
export async function intentarEnvio(
  evento: Pick<EventoIntegracion, 'id' | 'destino' | 'herramienta' | 'datos' | 'intentos'>,
  llamar: Llamar,
): Promise<CambioEvento> {
  try {
    const respuesta = await llamar(evento.destino, evento.herramienta, { ...evento.datos, id_mensaje: idMensajeDe(evento) }, TIEMPO_ENVIO_MS);
    return { estado: 'enviado', intentos: evento.intentos + 1, respuesta: respuesta === undefined ? null : JSON.stringify(respuesta), enviadoEn: new Date(), ultimoError: null };
  } catch (error) {
    const mensaje = (error as Error).message;
    if (error instanceof SinConexion) return { estado: 'desactivado', ultimoError: mensaje };
    const intentos = evento.intentos + 1;
    return { estado: intentos >= MAXIMO_INTENTOS ? 'fallido' : 'pendiente', intentos, ultimoError: mensaje };
  }
}

let enCurso = false;

// Envía los eventos pendientes, del más viejo al más nuevo.
export async function despachar(limite = 20, llamar: Llamar = llamarHerramienta) {
  if (enCurso) return { enviados: 0, pendientes: 0, fallidos: 0, desactivados: 0, enCurso: true };
  enCurso = true;
  const resumen = { enviados: 0, pendientes: 0, fallidos: 0, desactivados: 0 };
  try {
    const repo = (await bd()).getRepository(EventoIntegracion);
    const lista = await repo.find({ where: { estado: 'pendiente' }, order: { id: 'ASC' }, take: limite });
    for (const evento of lista) {
      const cambios = await intentarEnvio(evento, llamar);
      await repo.update(evento.id, cambios);
      const clave = { enviado: 'enviados', pendiente: 'pendientes', fallido: 'fallidos', desactivado: 'desactivados' } as const;
      resumen[clave[cambios.estado ?? 'pendiente']]++;
    }
    return resumen;
  } finally {
    enCurso = false;
  }
}

// Vuelve a poner en cola lo fallido y lo desactivado (por ejemplo, después de
// configurar la URL del MCP de otro proyecto) y despacha.
export async function reintentar() {
  const repo = (await bd()).getRepository(EventoIntegracion);
  await repo.update({ estado: In(['fallido', 'desactivado']) }, { estado: 'pendiente', intentos: 0 });
  return despachar(100);
}

export async function estadoIntegraciones() {
  const db = await bd();
  const conteo: { destino: Destino; estado: string; total: number }[] = await db.query(
    'SELECT destino, estado, count(*)::int AS total FROM eventos_integracion GROUP BY destino, estado',
  );
  const ultimos = await db.getRepository(EventoIntegracion).find({ order: { id: 'DESC' }, take: 20 });
  return {
    destinos: DESTINOS.map((destino) => ({
      destino,
      descripcion: CONTRATO[destino].descripcion,
      configurado: configuracion(destino) !== null,
      herramientas: CONTRATO[destino].herramientas,
      eventos: Object.fromEntries(conteo.filter((c) => c.destino === destino).map((c) => [c.estado, c.total])),
    })),
    ultimos,
  };
}
