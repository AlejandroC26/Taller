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
