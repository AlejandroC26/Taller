import { invalido, prohibido } from '../comun/errores';

// Reglas puras de las órdenes de servicio: no tocan la base de datos, así se prueban
// solas y las cumple quien entre por cualquier puerta (API o MCP).

export const ESTADOS = [
  'recibido',
  'en_diagnostico',
  'diagnosticado',
  'aprobado',
  'en_reparacion',
  'terminado',
  'entregado',
  'cancelado',
] as const;
export type Estado = (typeof ESTADOS)[number];

export const ETAPAS = ['diagnostico', 'reparacion'] as const;
export type Etapa = (typeof ETAPAS)[number];

export interface PasoHistorial {
  estado: Estado;
  fecha: string;
  usuario: string;
  nota?: string;
}

// Órdenes que todavía ocupan el taller.
export const ABIERTOS: readonly Estado[] = ESTADOS.filter(
  (e) => e !== 'entregado' && e !== 'cancelado',
);

// Cambios de estado permitidos. Lo que no está aquí, no se puede hacer.
export const SIGUIENTE: Record<Estado, readonly Estado[]> = {
  recibido: ['en_diagnostico', 'cancelado'],
  en_diagnostico: ['diagnosticado', 'cancelado'],
  diagnosticado: ['aprobado', 'cancelado'],
  aprobado: ['en_reparacion', 'cancelado'],
  en_reparacion: ['terminado', 'cancelado'],
  terminado: ['entregado'],
  entregado: [],
  cancelado: [],
};

export const puedePasar = (actual: Estado, nuevo: Estado) =>
  SIGUIENTE[actual].includes(nuevo);

export function exigirTransicion(actual: Estado, nuevo: Estado, codigo: string) {
  if (!puedePasar(actual, nuevo)) {
    throw invalido(`La orden ${codigo} está ${actual}: no puede pasar a ${nuevo}`);
  }
}

export const codigoOrden = (id: number) => 'OT-' + String(id).padStart(4, '0');

// Acepta OT-0001, ot-1, OT1 o solo el número.
export function numeroOrden(codigo: string): number | null {
  const numero = Number(/^(?:OT-?)?(\d{1,9})$/i.exec(String(codigo).trim())?.[1]);
  return numero > 0 ? numero : null;
}

// En qué estados se puede asignar un mecánico a cada etapa y a qué estado pasa la
// orden con la asignación.
export const ASIGNABLE: Record<Etapa, { desde: readonly Estado[]; pasaA: Estado }> = {
  diagnostico: { desde: ['recibido', 'en_diagnostico'], pasaA: 'en_diagnostico' },
  reparacion: { desde: ['aprobado', 'en_reparacion'], pasaA: 'en_reparacion' },
};

export function estadoTrasAsignar(estado: Estado, etapa: Etapa, codigo: string): Estado {
  const regla = ASIGNABLE[etapa];
  if (!regla.desde.includes(estado)) {
    throw invalido(
      `La orden ${codigo} está ${estado}: para asignar ${etapa} debe estar ` +
        regla.desde.join(' o '),
    );
  }
  return regla.pasaA;
}

// La etapa en la que trabaja hoy un mecánico asignado.
export function etapaActual(estado: Estado): Etapa | null {
  if (estado === 'en_diagnostico') return 'diagnostico';
  if (estado === 'en_reparacion') return 'reparacion';
  return null;
}

// Quién ve una orden: el personal, todas; el mecánico, solo las que tiene asignadas;
// el concesionario, solo las de carros que él envió. A quien no la ve se le responde
// 404, no 403: así no sabe que existe.
export function puedeVerOrden(
  rol: string,
  orden: { asignado: boolean; origen: 'taller' | 'concesionario' },
): boolean {
  if (rol === 'administrador' || rol === 'recepcionista') return true;
  if (rol === 'mecanico') return orden.asignado;
  if (rol === 'concesionario') return orden.origen === 'concesionario';
  return false;
}

// Quién registra diagnóstico, horas y partes: el mecánico asignado a esa etapa y el
// administrador. La recepcionista no.
export function exigirTrabajo(rol: string, asignadoALaEtapa: boolean, etapa: Etapa) {
  if (rol === 'administrador') return;
  if (rol === 'mecanico' && asignadoALaEtapa) return;
  throw prohibido(
    rol === 'mecanico'
      ? `No está asignado a la etapa de ${etapa} de esta orden`
      : 'Solo el mecánico asignado o un administrador registra este trabajo',
  );
}

export interface FilaCarga {
  mecanicoId: string;
  ordenId: number;
  estado: Estado;
  etapa: Etapa;
}

// Disponibilidad: cuántas órdenes abiertas tiene cada mecánico. Sin órdenes, está
// disponible. Los más libres salen primero.
export function cargaPorMecanico(
  mecanicos: { id: string; nombre: string; apellido: string }[],
  filas: FilaCarga[],
) {
  return mecanicos
    .map((m) => {
      const suyas = filas.filter((f) => f.mecanicoId === m.id && ABIERTOS.includes(f.estado));
      return {
        id: m.id,
        nombre: `${m.nombre} ${m.apellido}`,
        carga: new Set(suyas.map((f) => f.ordenId)).size,
        disponible: suyas.length === 0,
        ordenes: suyas.map((f) => ({ codigo: codigoOrden(f.ordenId), estado: f.estado, etapa: f.etapa })),
      };
    })
    .sort((a, b) => a.carga - b.carga || a.nombre.localeCompare(b.nombre));
}

export const paso = (estado: Estado, usuario: string, nota?: string): PasoHistorial => ({
  estado,
  fecha: new Date().toISOString(),
  usuario,
  ...(nota ? { nota } : {}),
});
