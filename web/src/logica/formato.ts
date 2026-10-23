import type { Estado } from '../api/tipos';

const moneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// $ 120.000 (los pesos se muestran sin centavos).
export const pesos = (valor: number | null | undefined) => moneda.format(Math.round(valor ?? 0));

const fechaHora = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});
export const fecha = (iso: string | null | undefined) => (iso ? fechaHora.format(new Date(iso)) : '—');

const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
export const horas = (valor: number) => `${decimal.format(valor)} h`;
export const numero = (valor: number) => decimal.format(valor);

export const NOMBRE_ESTADO: Record<Estado, string> = {
  recibido: 'Recibido',
  en_diagnostico: 'En diagnóstico',
  diagnosticado: 'Por aprobar',
  aprobado: 'Aprobado',
  en_reparacion: 'En reparación',
  terminado: 'Terminado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

// 1 paso, 2 pasos.
export const cuenta = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

const NOMBRE_ROL: Record<string, string> = {
  administrador: 'Administrador',
  recepcionista: 'Recepcionista',
  mecanico: 'Mecánico',
  concesionario: 'Concesionario',
};
export const nombreRol = (rol: string) => NOMBRE_ROL[rol] ?? rol;

// Tono de la píldora de estado (DESIGN.md): azul = en progreso, violeta = espera
// validación, teal = aprobado, menta = hecho, magenta = alerta, gris = el resto.
export type Tono = 'progreso' | 'revision' | 'aprobado' | 'listo' | 'alerta' | 'neutro';
const TONO: Record<Estado, Tono> = {
  recibido: 'neutro',
  en_diagnostico: 'progreso',
  diagnosticado: 'revision',
  aprobado: 'aprobado',
  en_reparacion: 'progreso',
  terminado: 'listo',
  entregado: 'listo',
  cancelado: 'neutro',
};
export const tonoDe = (estado: Estado): Tono => TONO[estado];

// Para <input type="datetime-local">: la hora local sin zona.
export function aEntradaLocal(fechaHoraLocal: Date) {
  const d = new Date(fechaHoraLocal.getTime() - fechaHoraLocal.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}
