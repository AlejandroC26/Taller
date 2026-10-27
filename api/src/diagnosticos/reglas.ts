import { invalido } from '../comun/errores';
import type { Causa } from '../garantias/reglas';
import { requiereEvidencia } from '../garantias/reglas';

// Reglas puras del diagnóstico y de sus evidencias.

export const TIPOS_EVIDENCIA: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
export const MAXIMO_EVIDENCIA = 5 * 1024 * 1024;

// El tipo se decide por la firma del archivo, no por lo que diga quien lo sube.
export function tipoPorFirma(datos: Uint8Array): string | null {
  const b = (i: number) => datos[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return 'image/png';
  if (String.fromCharCode(...datos.slice(0, 4)) === 'RIFF' && String.fromCharCode(...datos.slice(8, 12)) === 'WEBP') return 'image/webp';
  if (String.fromCharCode(...datos.slice(0, 5)) === '%PDF-') return 'application/pdf';
  return null;
}

export function validarEvidencia(datos: Uint8Array): string {
  if (datos.length === 0) throw invalido('El archivo está vacío');
  if (datos.length > MAXIMO_EVIDENCIA) throw invalido('La evidencia no puede pasar de 5 MB');
  const tipo = tipoPorFirma(datos);
  if (!tipo) throw invalido('Solo se aceptan fotos (JPG, PNG o WEBP) o PDF');
  return tipo;
}

// Nombre seguro para guardar: sin rutas ni caracteres raros.
export const nombreSeguro = (nombre: string) =>
  (nombre.split(/[\\/]/).pop() ?? 'evidencia').replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'evidencia';

export interface TareaParaFinalizar {
  id: number;
  servicioNombre: string;
  causa: Causa | null;
  garantiaAplica: boolean;
  garantiaMotivo: string;
  fija: boolean;
  evidencias: number;
}

// Antes de enviar al concesionario: al menos un servicio propio, cada causa con su
// motivo y las evidencias que exige el dictamen.
export function exigirListoParaFinalizar(tareas: TareaParaFinalizar[], porGarantia: boolean, evidenciasOrden: number) {
  const propias = tareas.filter((t) => !t.fija);
  if (propias.length === 0) throw invalido('El diagnóstico necesita al menos un servicio');
  for (const t of propias) {
    if (t.causa && !t.garantiaMotivo.trim()) {
      throw invalido(`Explique el motivo del dictamen de garantía en «${t.servicioNombre}»`);
    }
    if (t.garantiaAplica && t.evidencias === 0) {
      throw invalido(`«${t.servicioNombre}»: el dictamen dice que aplica garantía; adjunte al menos una evidencia`);
    }
  }
  if (requiereEvidencia(false, porGarantia) && evidenciasOrden === 0) {
    throw invalido('La orden vino por garantía: adjunte al menos una evidencia que respalde el dictamen');
  }
}
