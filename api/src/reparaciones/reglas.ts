import { pesos } from '../comun/columnas';
import { invalido } from '../comun/errores';
import type { Costo } from '../diagnosticos/reglas';

// Un registro de horas no puede durar más de una jornada larga.
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

export interface DatosLiquidacion {
  tarifaHora: number;
  tareas: { valorServicio: number; completada: boolean }[];
  horas: { horas: number }[];
  partes: { cantidad: number; precioUnitario: number }[];
}

export interface LineaFactura {
  concepto: string;
  cantidad: number;
  valor_unitario: number;
}

// Las líneas que se le envían al proyecto de facturación: un servicio por tarea hecha,
// la mano de obra por horas y cada parte usada.
export function lineasFactura(d: {
  tarifaHora: number;
  tareas: { descripcion: string; valorServicio: number; completada: boolean }[];
  horas: { horas: number }[];
  partes: { descripcion: string; cantidad: number; precioUnitario: number }[];
}): LineaFactura[] {
  const horas = pesos(d.horas.reduce((s, h) => s + h.horas, 0));
  return [
    ...d.tareas
      .filter((t) => t.completada && t.valorServicio > 0)
      .map((t) => ({ concepto: `Servicio: ${t.descripcion}`, cantidad: 1, valor_unitario: t.valorServicio })),
    ...(horas > 0 ? [{ concepto: 'Mano de obra (horas)', cantidad: horas, valor_unitario: d.tarifaHora }] : []),
    ...d.partes.map((p) => ({ concepto: p.descripcion, cantidad: p.cantidad, valor_unitario: p.precioUnitario })),
  ];
}

// Lo que se cobra de verdad: servicios de las tareas hechas, el tiempo que tomó y las
// partes gastadas.
export function liquidar(d: DatosLiquidacion): Costo {
  const servicios = d.tareas
    .filter((t) => t.completada)
    .reduce((s, t) => s + t.valorServicio, 0);
  const horas = d.horas.reduce((s, h) => s + h.horas, 0);
  const manoObra = horas * d.tarifaHora;
  const partes = d.partes.reduce((s, p) => s + p.cantidad * p.precioUnitario, 0);
  return {
    horas: pesos(horas),
    manoObra: pesos(manoObra),
    servicios: pesos(servicios),
    repuestos: pesos(partes),
    total: pesos(servicios + manoObra + partes),
  };
}
