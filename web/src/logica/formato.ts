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

// Tono de la etiqueta: naranja = en curso (algo pasa ahora), verde = listo, neutro = el
// resto. El color es solo para estado: nunca para botones ni superficies.
export type Tono = 'vivo' | 'listo' | 'neutro';
export function tonoDe(estado: Estado): Tono {
  if (estado === 'en_diagnostico' || estado === 'en_reparacion') return 'vivo';
  if (estado === 'terminado' || estado === 'entregado') return 'listo';
  return 'neutro';
}

// Para <input type="datetime-local">: la hora local sin zona.
export function aEntradaLocal(fechaHoraLocal: Date) {
  const d = new Date(fechaHoraLocal.getTime() - fechaHoraLocal.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}
