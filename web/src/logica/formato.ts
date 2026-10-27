import type { Causa, Especialidad, Estado, Pagador } from '../api/tipos';

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

const soloFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const dia = (aaaammdd: string | null | undefined) => (aaaammdd ? soloFecha.format(new Date(`${aaaammdd}T00:00:00Z`)) : '—');

const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
export const horas = (valor: number) => `${decimal.format(valor)} h`;
export const numero = (valor: number) => decimal.format(valor);

export const NOMBRE_ESTADO: Record<Estado, string> = {
  agendada: 'Agendada',
  en_diagnostico: 'En diagnóstico',
  remitida: 'Remitida',
  validando_garantia: 'Validando garantía',
  en_cotizacion: 'En cotización',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  en_reparacion: 'En reparación',
  pendiente_facturacion: 'Pendiente de facturación',
  facturada: 'Facturada',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
};

export const NOMBRE_ESPECIALIDAD: Record<Especialidad, string> = {
  mantenimiento_general: 'Mantenimiento general',
  frenos: 'Frenos',
  suspension: 'Suspensión',
  motor: 'Motor',
  electrico: 'Eléctrico',
  transmision: 'Transmisión',
};

export const NOMBRE_CAUSA: Record<Causa, string> = {
  defecto_fabrica: 'Defecto de fábrica',
  repuesto_defectuoso: 'Repuesto defectuoso',
  mala_instalacion_taller: 'Mala instalación de un taller',
  manipulacion_cliente: 'Manipulación del cliente',
  desgaste_normal: 'Desgaste normal',
};

export const NOMBRE_PAGADOR: Record<Pagador, string> = {
  cliente: 'Cliente',
  fabricante: 'Fabricante (garantía)',
  tienda: 'Tienda (garantía)',
  taller: 'Taller (garantía)',
};

// Lo que sugiere el sistema según la causa (espejo de api/src/garantias/reglas.ts); el
// mecánico decide.
export const dictamenSugerido = (causa: Causa | null) =>
  causa === 'defecto_fabrica' || causa === 'repuesto_defectuoso' || causa === 'mala_instalacion_taller';

// 1 paso, 2 pasos.
export const cuenta = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

const NOMBRE_ROL: Record<string, string> = {
  administrador: 'Administrador',
  mecanico: 'Mecánico',
  agente: 'Agente (MCP)',
};
export const nombreRol = (rol: string) => NOMBRE_ROL[rol] ?? rol;

// Tono de la píldora de estado (DESIGN.md): azul = en progreso, violeta = espera a otro
// sistema, teal = aprobado, menta = hecho, magenta = alerta, gris = el resto.
export type Tono = 'progreso' | 'revision' | 'aprobado' | 'listo' | 'alerta' | 'neutro';
const TONO: Record<Estado, Tono> = {
  agendada: 'neutro',
  en_diagnostico: 'progreso',
  remitida: 'progreso',
  validando_garantia: 'revision',
  en_cotizacion: 'revision',
  aprobada: 'aprobado',
  rechazada: 'alerta',
  en_reparacion: 'progreso',
  pendiente_facturacion: 'revision',
  facturada: 'listo',
  entregada: 'listo',
  cancelada: 'neutro',
};
export const tonoDe = (estado: Estado): Tono => TONO[estado];

// Para <input type="datetime-local">: la hora local sin zona.
export function aEntradaLocal(fechaHoraLocal: Date) {
  const d = new Date(fechaHoraLocal.getTime() - fechaHoraLocal.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}
