import type { Costo } from '../api/tipos';

// Copia de la regla de la API (api/src/diagnosticos/reglas.ts) para mostrar el costo
// mientras el mecánico escribe. Al guardar, el costo oficial lo calcula la API.
const centavos = (valor: number) => Math.round(valor * 100) / 100;

export function costoEstimado(
  tareas: { horasEstimadas: number; valorServicio: number; repuestos: { cantidad: number; precioUnitario: number }[] }[],
  tarifaHora: number,
): Costo {
  const horas = tareas.reduce((s, t) => s + (Number(t.horasEstimadas) || 0), 0);
  const servicios = tareas.reduce((s, t) => s + (Number(t.valorServicio) || 0), 0);
  const repuestos = tareas.reduce(
    (s, t) => s + t.repuestos.reduce((r, p) => r + (Number(p.cantidad) || 0) * (Number(p.precioUnitario) || 0), 0),
    0,
  );
  const manoObra = horas * tarifaHora;
  return {
    horas: centavos(horas),
    manoObra: centavos(manoObra),
    servicios: centavos(servicios),
    repuestos: centavos(repuestos),
    total: centavos(manoObra + servicios + repuestos),
  };
}
