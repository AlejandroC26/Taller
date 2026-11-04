import type { Especialidad } from '../talleres/reglas';
import { ESPECIALIDADES } from '../talleres/reglas';

// Reglas puras del prediagnóstico: a partir de lo que el cliente le contó al
// concesionario, qué especialidad necesita el carro y a qué sede va.

export type Ruta = 'especializada' | 'revision_general';

export interface Prediagnostico {
  especialidad: Especialidad;
  servicios: string[];
  confianza: number;
  ruta: Ruta;
  resumen: string;
  fuente: 'modelo' | 'reglas';
  taller?: { id: number; codigo: string; nombre: string };
}

export interface ServicioCatalogo {
  sku: string;
  nombre: string;
  especialidad: Especialidad;
  palabrasClave: string[];
}

export interface SedeCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  tipo: 'mantenimiento' | 'especializado';
  especialidades: Especialidad[];
  activo: boolean;
}

// Con esta confianza o más, el carro va directo a la sede especializada.
export const UMBRAL_ESPECIALIZADA = 0.6;

export const sinTildes = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Cuenta coincidencias de palabras clave por especialidad. La confianza sube con las
// coincidencias y baja si apuntan a varias especialidades a la vez.
export function porPalabrasClave(
  texto: string,
  catalogo: ServicioCatalogo[],
): { especialidad: Especialidad; servicios: string[]; confianza: number } {
  const limpio = sinTildes(texto);
  const porEspecialidad = new Map<Especialidad, { golpes: number; servicios: Set<string> }>();
  for (const s of catalogo) {
    if (s.especialidad === 'mantenimiento_general') continue;
    const golpes = s.palabrasClave.filter((p) => limpio.includes(sinTildes(p))).length;
    if (golpes === 0) continue;
    const actual = porEspecialidad.get(s.especialidad) ?? { golpes: 0, servicios: new Set<string>() };
    actual.golpes += golpes;
    actual.servicios.add(s.sku);
    porEspecialidad.set(s.especialidad, actual);
  }
  const total = [...porEspecialidad.values()].reduce((s, v) => s + v.golpes, 0);
  const mejor = [...porEspecialidad.entries()].sort((a, b) => b[1].golpes - a[1].golpes)[0];
  if (!mejor) return { especialidad: 'mantenimiento_general', servicios: [], confianza: 0 };
  const [especialidad, { golpes, servicios }] = mejor;
  const fuerza = Math.min(1, golpes / 2);
  const exclusividad = golpes / total;
  return { especialidad, servicios: [...servicios], confianza: Math.round(fuerza * exclusividad * 100) / 100 };
}

// La sede que recibe: si la ruta es especializada, una sede especializada con esa
// especialidad; si no, la de mantenimiento.
export function elegirSede(ruta: Ruta, especialidad: Especialidad, sedes: SedeCatalogo[]): SedeCatalogo | null {
  const activas = sedes.filter((s) => s.activo);
  if (ruta === 'especializada') {
    const especialista = activas.find((s) => s.tipo === 'especializado' && s.especialidades.includes(especialidad));
    if (especialista) return especialista;
  }
  return activas.find((s) => s.tipo === 'mantenimiento') ?? activas[0] ?? null;
}

// Va directo al especialista solo si se sabe qué tiene y hay sede para eso; en la duda,
// revisión general.
export function decidirRuta(especialidad: Especialidad, confianza: number, sedes: SedeCatalogo[]): Ruta {
  const hayEspecialista = sedes.some((s) => s.activo && s.tipo === 'especializado' && s.especialidades.includes(especialidad));
  return confianza >= UMBRAL_ESPECIALIZADA && especialidad !== 'mantenimiento_general' && hayEspecialista
    ? 'especializada'
    : 'revision_general';
}

// La salida del modelo solo se acepta si habla del catálogo real.
export function validarSalidaModelo(
  salida: unknown,
  catalogo: ServicioCatalogo[],
): { especialidad: Especialidad; servicios: string[]; confianza: number; resumen: string } | null {
  if (!salida || typeof salida !== 'object') return null;
  const s = salida as Record<string, unknown>;
  const especialidad = String(s.especialidad ?? '');
  const confianza = Number(s.confianza);
  if (!(ESPECIALIDADES as readonly string[]).includes(especialidad)) return null;
  if (!Number.isFinite(confianza) || confianza < 0 || confianza > 1) return null;
  const skus = new Set(catalogo.map((c) => c.sku));
  const servicios = (Array.isArray(s.servicios) ? s.servicios : []).map(String).filter((x) => skus.has(x));
  return {
    especialidad: especialidad as Especialidad,
    servicios,
    confianza,
    resumen: String(s.resumen ?? '').slice(0, 500),
  };
}

export const resumenPorReglas = (texto: string, especialidad: Especialidad, confianza: number) =>
  confianza === 0
    ? 'El cliente no describe una falla clara: requiere revisión general.'
    : `Por lo que cuenta el cliente («${texto.slice(0, 140)}»), apunta a ${especialidad.replace('_', ' ')}.`;

// ---------- Prediagnóstico guardado ----------

export const codigoPrediagnostico = (id: number) => 'PD-' + String(id).padStart(4, '0');

// Acepta PD-0001, pd-1, PD1 o solo el número.
export function numeroPrediagnostico(codigo: string): number | null {
  const numero = Number(/^(?:PD-?)?(\d{1,9})$/i.exec(String(codigo).trim())?.[1]);
  return numero > 0 ? numero : null;
}

const NOMBRE_ESPECIALIDAD: Record<Especialidad, string> = {
  mantenimiento_general: 'mantenimiento general',
  frenos: 'frenos',
  suspension: 'suspensión',
  motor: 'motor',
  electrico: 'sistema eléctrico',
  transmision: 'transmisión',
};

// Una o dos frases que el concesionario le puede mostrar al cliente: por qué va a esa sede.
export function motivoDecision(
  pre: Pick<Prediagnostico, 'ruta' | 'especialidad' | 'confianza'>,
  sede: { nombre: string } | null,
  servicios: string[] = [],
): string {
  if (!sede) return 'Por ahora no hay una sede activa para recibir el vehículo.';
  const area = NOMBRE_ESPECIALIDAD[pre.especialidad];
  if (pre.ruta === 'especializada') {
    const detalle = servicios.length ? ` (${servicios.slice(0, 2).join(', ').toLowerCase()})` : '';
    return `Lo que cuenta el cliente apunta a ${area}${detalle}. Por eso va directo a ${sede.nombre}, la sede especialista.`;
  }
  if (pre.especialidad !== 'mantenimiento_general' && pre.confianza >= UMBRAL_ESPECIALIZADA) {
    return `Lo que cuenta el cliente apunta a ${area}, pero hoy no hay una sede especialista activa para eso. Por eso va a revisión general en ${sede.nombre}.`;
  }
  return `Con lo que cuenta el cliente no hay una especialidad clara. Por eso va primero a revisión general en ${sede.nombre}; si hace falta, desde ahí lo remiten a la sede especialista.`;
}
