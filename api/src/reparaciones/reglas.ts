import { pesos } from '../comun/columnas';
import { invalido } from '../comun/errores';

// Las horas se registran como control (la mano de obra se cobra por el SKU). Un registro
// no puede durar más de una jornada larga.
export const MAXIMO_HORAS_REGISTRO = 16;

export function horasEntre(inicio: Date, fin: Date): number {
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    throw invalido('Las fechas de inicio y fin no son válidas');
  }
  const horas = (fin.getTime() - inicio.getTime()) / 3_600_000;
  if (horas <= 0) throw invalido('La hora de fin debe ser posterior a la de inicio');
  if (horas > MAXIMO_HORAS_REGISTRO) {
    throw invalido(`Un registro no puede pasar de ${MAXIMO_HORAS_REGISTRO} horas`);
  }
  return pesos(horas);
}

// Horas reales contra las estándar de los SKU: para la productividad del taller.
export const eficiencia = (estandar: number, reales: number) => (reales > 0 ? pesos(estandar / reales) : null);
