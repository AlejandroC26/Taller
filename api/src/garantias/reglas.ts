import type { Cobertura } from '../integraciones/concesionario/proveedor';
import type { Especialidad } from '../talleres/reglas';

// Reglas puras de la garantía. La garantía la dictamina el mecánico (causa + aplica o no,
// con su motivo y evidencias) y la valida el concesionario. La plata de la garantía no
// la paga el cliente: sale de la dispersión del responsable.

export const CAUSAS = [
  'defecto_fabrica',
  'repuesto_defectuoso',
  'mala_instalacion_taller',
  'manipulacion_cliente',
  'desgaste_normal',
] as const;
export type Causa = (typeof CAUSAS)[number];

export const PAGADORES = ['cliente', 'fabricante', 'tienda', 'taller'] as const;
export type Pagador = (typeof PAGADORES)[number];

export const NOMBRE_CAUSA: Record<Causa, string> = {
  defecto_fabrica: 'Defecto de fábrica',
  repuesto_defectuoso: 'Repuesto defectuoso',
  mala_instalacion_taller: 'Mala instalación de un taller',
  manipulacion_cliente: 'Manipulación del cliente',
  desgaste_normal: 'Desgaste normal',
};

// Lo que sugiere el sistema; el mecánico decide.
export const dictamenSugerido = (causa: Causa | null): boolean =>
  causa === 'defecto_fabrica' || causa === 'repuesto_defectuoso' || causa === 'mala_instalacion_taller';

// Quién paga si el concesionario da la garantía por válida.
export function pagadorPorCausa(causa: Causa | null): Pagador {
  if (causa === 'defecto_fabrica') return 'fabricante';
  if (causa === 'repuesto_defectuoso') return 'tienda';
  if (causa === 'mala_instalacion_taller') return 'taller';
  return 'cliente';
}

// Evidencia obligatoria: si el mecánico dice que aplica, o si la orden vino por garantía
// (para respaldar también un «no aplica», por ejemplo por manipulación del cliente).
export const requiereEvidencia = (aplica: boolean, porGarantia: boolean) => aplica || porGarantia;

// La garantía de fábrica de la marca: 3 años desde la venta o 60.000 km, lo que pase
// primero, y solo para los sistemas que cubre.
export const ANIOS_GARANTIA = 3;
export const KM_GARANTIA = 60_000;

export function coberturaDe(
  fechaVenta: string,
  kilometraje: number,
  cubre: Especialidad[],
  hoy = new Date(),
): Cobertura {
  const vence = new Date(fechaVenta);
  vence.setFullYear(vence.getFullYear() + ANIOS_GARANTIA);
  const venceTexto = vence.toISOString().slice(0, 10);
  if (hoy > vence) {
    return { vigente: false, vence: venceTexto, kmMaximo: KM_GARANTIA, cubre, motivo: `La garantía venció el ${venceTexto}` };
  }
  if (kilometraje > KM_GARANTIA) {
    return {
      vigente: false,
      vence: venceTexto,
      kmMaximo: KM_GARANTIA,
      cubre,
      motivo: `El vehículo superó los ${KM_GARANTIA.toLocaleString('es-CO')} km de la garantía`,
    };
  }
  return { vigente: true, vence: venceTexto, kmMaximo: KM_GARANTIA, cubre };
}

export interface ServicioAValidar {
  tareaId: number;
  sku: string;
  especialidad: Especialidad;
  causa: Causa | null;
  aplica: boolean;
  motivo: string;
  evidencias: string[];
}

export interface ResultadoGarantia {
  tareaId: number;
  valida: boolean;
  motivo: string;
}

// Cómo responde el concesionario simulado. Un concesionario real decide a su manera; este
// respeta el dictamen del mecánico si el vehículo tiene cobertura para ese sistema y hay
// evidencias, y siempre explica por qué.
export function decidirComoConcesionario(cobertura: Cobertura, s: ServicioAValidar): ResultadoGarantia {
  const no = (motivo: string) => ({ tareaId: s.tareaId, valida: false, motivo });
  if (!s.causa) return no('Servicio sin causa de falla: no aplica garantía');
  if (!s.aplica) {
    return no(
      s.causa === 'manipulacion_cliente'
        ? `Manipulación del cliente: ${s.motivo || 'según el dictamen del taller'}`
        : s.causa === 'desgaste_normal'
          ? 'Desgaste normal: no lo cubre la garantía'
          : `El taller dictaminó que no aplica: ${s.motivo}`,
    );
  }
  if (!cobertura.vigente) return no(cobertura.motivo ?? 'Sin garantía vigente');
  if (!cobertura.cubre.includes(s.especialidad)) return no(`La garantía no cubre el sistema ${s.especialidad}`);
  if (s.evidencias.length === 0) return no('Sin evidencias que respalden el dictamen');
  return { tareaId: s.tareaId, valida: true, motivo: `Garantía válida: ${NOMBRE_CAUSA[s.causa].toLowerCase()}` };
}

// ---------- Estimación antes de ver el carro ----------

// Pistas en lo que cuenta el cliente. Es solo una estimación para el concesionario: la
// causa la dictamina el mecánico. Se revisan en este orden y gana la primera que aparece.
const PISTAS_CAUSA: [Causa, string[]][] = [
  ['mala_instalacion_taller', ['despues del servicio', 'despues de la reparacion', 'desde que lo arreglaron', 'mal instalad', 'quedo mal instalad']],
  ['repuesto_defectuoso', ['repuesto nuevo', 'pieza nueva', 'recien cambiad', 'acabo de cambiar', 'le cambiaron hace poco']],
  ['manipulacion_cliente', ['choque', 'me chocaron', 'lo modifique', 'modificad', 'lo arregle yo', 'yo mismo', 'inundad']],
  ['defecto_fabrica', ['desde que lo compre', 'desde nuevo', 'de fabrica', 'recien comprado', 'carro nuevo']],
  ['desgaste_normal', ['chill', 'rechin', 'gastad', 'desgast']],
];

const sinTildes = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function causaProbable(texto: string): Causa | null {
  const limpio = sinTildes(texto);
  return PISTAS_CAUSA.find(([, pistas]) => pistas.some((p) => limpio.includes(p)))?.[0] ?? null;
}

// El kilometraje que reporta el cliente puede ser más nuevo que el del concesionario: si ya
// pasó el límite, la garantía tampoco está vigente.
export function conKilometraje(cobertura: Cobertura, kilometraje?: number): Cobertura {
  if (kilometraje === undefined || !cobertura.vigente || kilometraje <= cobertura.kmMaximo) return cobertura;
  return {
    ...cobertura,
    vigente: false,
    motivo: `El vehículo superó los ${cobertura.kmMaximo.toLocaleString('es-CO')} km de la garantía`,
  };
}

// La garantía del vehículo con lo que probablemente pase en el taller: aplica si está
// vigente, cubre el sistema y la causa probable no la excluye (desgaste o manipulación).
export function garantiaProbable(cobertura: Cobertura, especialidad: Especialidad, texto: string) {
  const causa = causaProbable(texto);
  const aplica = cobertura.vigente && cobertura.cubre.includes(especialidad) && (causa === null || dictamenSugerido(causa));
  return { ...cobertura, aplica_probable: aplica, causa_probable: causa };
}

// ---------- Historial de un componente (consultar_manipulacion) ----------

export const TIPOS_EVENTO_COMPONENTE = ['reparacion', 'cambio_repuesto', 'manipulacion_cliente', 'otro_taller'] as const;
export type TipoEventoComponente = (typeof TIPOS_EVENTO_COMPONENTE)[number];

// Un servicio diagnosticado a ese VIN, con lo necesario para saber si el componente ya se tocó.
export interface TareaHistorial {
  codigo: string;
  // La orden que se está validando: sus reparaciones no cuentan, sus hallazgos sí.
  actual: boolean;
  especialidad: Especialidad;
  sku: string;
  causa: Causa | null;
  completada: boolean;
  conRepuestos: boolean;
  // Descripción, motivo del dictamen y observaciones del mecánico.
  texto: string;
  fechaDiagnostico: Date;
  fechaReparacion: Date | null;
}

export interface EventoComponente {
  fecha: string;
  tipo: TipoEventoComponente;
  especialidad: Especialidad;
  sku: string;
  codigo: string;
}

// Lo que el mecánico escribe cuando ve trabajo de otro taller.
const PISTAS_OTRO_TALLER = ['otro taller', 'taller externo', 'otro mecanico', 'taller particular'];

// El componente (especialidad y, si viene, SKU) ya se tocó si una orden anterior lo reparó o
// le cambió repuestos, o si algún diagnóstico encontró manipulación del cliente o trabajo de
// otro taller. La mala instalación del propio taller no cuenta: esa garantía sí aplica.
export function historialComponente(
  tareas: TareaHistorial[],
  filtro: { especialidad: Especialidad; sku?: string },
  enZona: (fecha: Date) => string = (fecha) => fecha.toISOString(),
): { manipulado: boolean; eventos: EventoComponente[] } {
  const eventos: (EventoComponente & { orden: number })[] = [];
  for (const t of tareas) {
    if (t.especialidad !== filtro.especialidad || (filtro.sku && t.sku !== filtro.sku)) continue;
    const evento = (tipo: TipoEventoComponente, fecha: Date) =>
      eventos.push({ fecha: enZona(fecha), tipo, especialidad: t.especialidad, sku: t.sku, codigo: t.codigo, orden: fecha.getTime() });
    if (!t.actual && t.completada) evento(t.conRepuestos ? 'cambio_repuesto' : 'reparacion', t.fechaReparacion ?? t.fechaDiagnostico);
    if (t.causa === 'manipulacion_cliente') evento('manipulacion_cliente', t.fechaDiagnostico);
    if (PISTAS_OTRO_TALLER.some((p) => sinTildes(t.texto).includes(p))) evento('otro_taller', t.fechaDiagnostico);
  }
  eventos.sort((a, b) => a.orden - b.orden);
  return { manipulado: eventos.length > 0, eventos: eventos.map(({ orden: _orden, ...e }) => e) };
}
