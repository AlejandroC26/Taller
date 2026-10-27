import { pesos } from '../comun/columnas';
import type { Causa, Pagador } from '../garantias/reglas';
import { NOMBRE_CAUSA } from '../garantias/reglas';

// Lo que el taller le envía a facturación para armar la orden: la mano de obra con su
// precio (SKU) y, si hacen falta, los repuestos solo con código universal y cantidad.
// Facturación busca los precios en las tiendas y le escribe al cliente por Telegram.

export interface GarantiaLinea {
  aplica: boolean;
  valida: boolean;
  pagador: Pagador;
  motivo: string;
}

export interface TareaCotizable {
  id: number;
  servicioSku: string;
  servicioNombre: string;
  descripcion: string;
  precio: number;
  causa: Causa | null;
  garantiaAplica: boolean;
  garantiaValida: boolean | null;
  garantiaRespuesta: string | null;
  pagador: Pagador;
  completada?: boolean;
  repuestos: { codigoRepuesto: string; descripcion: string; cantidad: number }[];
}

export interface Cotizacion {
  codigo: string;
  id_relacion: string;
  taller: string;
  sede: string;
  cliente: { cedula: string; nombre: string; telefono: string };
  vehiculo: { vin: string; placa: string; descripcion: string };
  mano_obra: { tarea_id: number; sku: string; descripcion: string; precio: number; causa: string | null; garantia: GarantiaLinea }[];
  repuestos: { tarea_id: number; codigo_repuesto: string; descripcion: string; cantidad: number; garantia: GarantiaLinea }[];
  total_mano_obra: number;
  total_mano_obra_cliente: number;
  hay_repuestos: boolean;
  mensaje_garantia: string;
}

const garantiaDe = (t: TareaCotizable): GarantiaLinea => ({
  aplica: t.garantiaAplica,
  valida: t.garantiaValida === true,
  pagador: t.garantiaValida ? t.pagador : 'cliente',
  motivo: t.garantiaRespuesta ?? (t.causa ? NOMBRE_CAUSA[t.causa] : 'Sin falla atribuible'),
});

// Resumen para que facturación se lo envíe al cliente: qué va por garantía, qué no y por
// qué.
export function mensajeGarantia(tareas: TareaCotizable[]): string {
  const conCausa = tareas.filter((t) => t.causa);
  if (conCausa.length === 0) return 'Ningún servicio tiene falla atribuible a garantía: todo lo paga el cliente.';
  const validas = conCausa.filter((t) => t.garantiaValida);
  const noValidas = conCausa.filter((t) => !t.garantiaValida && (t.garantiaAplica || t.causa !== 'desgaste_normal'));
  const partes: string[] = [];
  if (validas.length) {
    partes.push(`Va por garantía: ${validas.map((t) => `${t.servicioNombre} (${t.garantiaRespuesta ?? 'válida'})`).join('; ')}.`);
  }
  if (noValidas.length) {
    partes.push(
      `La garantía no es válida para: ${noValidas.map((t) => `${t.servicioNombre} — ${t.garantiaRespuesta ?? 'no aplica'}`).join('; ')}.`,
    );
  }
  if (!validas.length && !noValidas.length) partes.push('Lo revisado es desgaste normal: no lo cubre la garantía.');
  return partes.join(' ');
}

export function armarCotizacion(
  datos: Omit<Cotizacion, 'mano_obra' | 'repuestos' | 'total_mano_obra' | 'total_mano_obra_cliente' | 'hay_repuestos' | 'mensaje_garantia'>,
  tareas: TareaCotizable[],
): Cotizacion {
  const mano_obra = tareas.map((t) => ({
    tarea_id: t.id,
    sku: t.servicioSku,
    descripcion: t.descripcion ? `${t.servicioNombre}: ${t.descripcion}` : t.servicioNombre,
    precio: t.precio,
    causa: t.causa,
    garantia: garantiaDe(t),
  }));
  const repuestos = tareas.flatMap((t) =>
    t.repuestos.map((r) => ({
      tarea_id: t.id,
      codigo_repuesto: r.codigoRepuesto,
      descripcion: r.descripcion,
      cantidad: r.cantidad,
      garantia: garantiaDe(t),
    })),
  );
  return {
    ...datos,
    mano_obra,
    repuestos,
    total_mano_obra: pesos(mano_obra.reduce((s, l) => s + l.precio, 0)),
    total_mano_obra_cliente: pesos(mano_obra.filter((l) => l.garantia.pagador === 'cliente').reduce((s, l) => s + l.precio, 0)),
    hay_repuestos: repuestos.length > 0,
    mensaje_garantia: mensajeGarantia(tareas),
  };
}

// Mano de obra de lo hecho: Σ precio del SKU de las tareas completadas.
export const manoObraRealizada = (tareas: { precio: number; completada: boolean }[]) =>
  pesos(tareas.filter((t) => t.completada).reduce((s, t) => s + t.precio, 0));
