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
