import { In } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { avisarDespacho } from './bandeja';
import { CONTRATO, configuracion } from './contrato';
import { llamarHerramienta, SinConexion } from './conector-mcp';
import { DESTINOS, EventoIntegracion } from './evento.entity';
import type { Destino } from './evento.entity';

export const MAXIMO_INTENTOS = 5;
// Facturación tarda de 20 a 35 s en dar el acuse de crear_cotizacion (le pregunta a la
// tienda antes de responder). La bandeja trabaja en segundo plano: se le da margen.
export const TIEMPO_ENVIO_MS = 90_000;
// Un minuto entre reintentos: alcanza para que pase el límite por minuto del concesionario.
export const ESPERA_REINTENTO_MS = 60_000;

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
    // Con las credenciales rechazadas, reintentar solo suma fallos (el concesionario bloquea
    // la IP con 10 en 5 minutos): queda fallido hasta corregir el token y usar reintentar_envios.
    if (rechazoDelServidor(mensaje) === 'credenciales') {
      return { estado: 'fallido', intentos, ultimoError: `Credenciales o acceso rechazados: revise MCP_${evento.destino.toUpperCase()}_TOKEN y _URL. ${mensaje}` };
    }
    return { estado: intentos >= MAXIMO_INTENTOS ? 'fallido' : 'pendiente', intentos, ultimoError: mensaje };
  }
}

// Rechazos que no se arreglan reintentando enseguida: credenciales o acceso (401, 403) y
// límite de llamadas (429).
export function rechazoDelServidor(mensaje: string | null | undefined): 'credenciales' | 'limite' | null {
  if (!mensaje) return null;
  if (/\b429\b|Too Many Requests/i.test(mensaje)) return 'limite';
  if (/\b40[13]\b|Credenciales no válidas|Unauthorized|Forbidden|denied access/i.test(mensaje)) return 'credenciales';
  return null;
}

let enCurso = false;

// Envía los eventos pendientes, del más viejo al más nuevo. Si un destino rechaza las
// credenciales o pide esperar (429), no se le envía nada más en esta vuelta.
export async function despachar(limite = 20, llamar: Llamar = llamarHerramienta) {
  if (enCurso) return { enviados: 0, pendientes: 0, fallidos: 0, desactivados: 0, enCurso: true };
  enCurso = true;
  const resumen = { enviados: 0, pendientes: 0, fallidos: 0, desactivados: 0 };
  const detenidos = new Set<Destino>();
  try {
    const repo = (await bd()).getRepository(EventoIntegracion);
    const lista = await repo.find({ where: { estado: 'pendiente' }, order: { id: 'ASC' }, take: limite });
    for (const evento of lista) {
      if (detenidos.has(evento.destino)) {
        resumen.pendientes++;
        continue;
      }
      const cambios = await intentarEnvio(evento, llamar);
      if (rechazoDelServidor(cambios.ultimoError)) detenidos.add(evento.destino);
      await repo.update(evento.id, cambios);
      // intentarEnvio nunca descarta: eso solo se hace a mano.
      const clave = { enviado: 'enviados', pendiente: 'pendientes', fallido: 'fallidos', desactivado: 'desactivados', descartado: 'desactivados' } as const;
      resumen[clave[cambios.estado ?? 'pendiente']]++;
    }
    // Lo que quedó pendiente (un corte, un 429) se reintenta solo, con el mismo id_mensaje,
    // sin esperar a que otra acción del taller dispare la bandeja.
    if (resumen.pendientes > 0) avisarDespacho(ESPERA_REINTENTO_MS);
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
