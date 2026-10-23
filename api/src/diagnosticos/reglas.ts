import { pesos } from '../comun/columnas';

export interface TareaACostear {
  horasEstimadas: number;
  valorServicio: number;
  repuestos: { cantidad: number; precioUnitario: number }[];
}

export interface Costo {
  horas: number;
  manoObra: number;
  servicios: number;
  repuestos: number;
  total: number;
}

// Costo estimado = horas × tarifa + valor de los servicios + repuestos.
export function costoEstimado(tareas: TareaACostear[], tarifaHora: number): Costo {
  const horas = tareas.reduce((s, t) => s + t.horasEstimadas, 0);
  const servicios = tareas.reduce((s, t) => s + t.valorServicio, 0);
  const repuestos = tareas.reduce(
    (s, t) => s + t.repuestos.reduce((r, p) => r + p.cantidad * p.precioUnitario, 0),
    0,
  );
  const manoObra = horas * tarifaHora;
  return {
    horas: pesos(horas),
    manoObra: pesos(manoObra),
    servicios: pesos(servicios),
    repuestos: pesos(repuestos),
    total: pesos(manoObra + servicios + repuestos),
  };
}
