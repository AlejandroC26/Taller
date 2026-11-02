import { invalido } from '../comun/errores';

// Reglas puras de las sedes y de su agenda.

export const TIPOS_TALLER = ['mantenimiento', 'especializado'] as const;
export type TipoTaller = (typeof TIPOS_TALLER)[number];

export const ESPECIALIDADES = [
  'mantenimiento_general',
  'frenos',
  'suspension',
  'motor',
  'electrico',
  'transmision',
] as const;
export type Especialidad = (typeof ESPECIALIDADES)[number];

// dias: 1 = lunes … 7 = domingo. Horas en formato HH:MM, hora de Colombia.
export interface Horario {
  dias: number[];
  apertura: string;
  cierre: string;
}

// Colombia no tiene horario de verano: siempre UTC-5.
export const ZONA = '-05:00';

const minutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};
const aHora = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

// Un instante en ISO 8601 con la hora de Colombia: 2026-11-03T08:00:00-05:00.
export const isoColombia = (instante: Date | string) =>
  `${new Date(new Date(instante).getTime() - 5 * 3_600_000).toISOString().slice(0, 19)}${ZONA}`;

// Fecha AAAA-MM-DD en Colombia de un instante ISO.
export const fechaLocal = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);

// Día de la semana (1 = lunes) de una fecha AAAA-MM-DD.
export function diaSemana(fecha: string): number {
  const d = new Date(`${fecha}T12:00:00${ZONA}`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function exigirFecha(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(`${fecha}T00:00:00${ZONA}`).getTime())) {
    throw invalido('La fecha debe tener el formato AAAA-MM-DD');
  }
}

export interface Franja {
  inicio: string; // ISO con zona de Colombia
  libres: number;
}

// Franjas de una hora dentro del horario de la sede, con cuántos cupos quedan. El cupo es
// el número de mecánicos de la sede (mínimo 1); cada cita ocupa su franja.
export function franjas(
  horario: Horario,
  fecha: string,
  ocupadas: string[],
  capacidad: number,
  ahora = new Date(),
): Franja[] {
  exigirFecha(fecha);
  if (!horario.dias.includes(diaSemana(fecha))) return [];
  const cupo = Math.max(1, capacidad);
  const resultado: Franja[] = [];
  for (let m = minutos(horario.apertura); m + 60 <= minutos(horario.cierre); m += 60) {
    const inicio = `${fecha}T${aHora(m)}:00${ZONA}`;
    if (new Date(inicio) <= ahora) continue;
    const usadas = ocupadas.filter((o) => new Date(o).getTime() === new Date(inicio).getTime()).length;
    resultado.push({ inicio, libres: Math.max(0, cupo - usadas) });
  }
  return resultado;
}

// La fecha pedida debe caer en una franja con cupo.
export function exigirFranjaLibre(disponibles: Franja[], fechaHora: string) {
  const pedida = new Date(fechaHora).getTime();
  const franja = disponibles.find((f) => new Date(f.inicio).getTime() === pedida);
  if (!franja) throw invalido('Esa hora no es una franja de la sede: consulte consultar_disponibilidad');
  if (franja.libres === 0) throw invalido('Esa franja ya está llena: elija otra con consultar_disponibilidad');
}
