import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import { bd } from '../base-datos/conexion';
import { invalido } from '../comun/errores';
import { enviarCotizacion } from '../cotizaciones/cotizaciones.service';
import { Evidencia } from '../diagnosticos/evidencia.entity';
import { urlEvidencia } from '../diagnosticos/evidencias.service';
import { Tarea } from '../diagnosticos/tarea.entity';
import { avisarDespacho, encolar } from '../integraciones/bandeja';
import { concesionario } from '../integraciones/concesionario';
import { solicitudGarantia } from '../integraciones/contrato';
import { unaVez } from '../integraciones/idempotencia';
import type { Orden } from '../ordenes/orden.entity';
import { cargarOrden, transicionar, unaOrden } from '../ordenes/ordenes.service';
import { codigoOrden, numeroOrden } from '../ordenes/reglas';
import { RelacionVehiculo } from '../relaciones/relacion.entity';
import { ESPECIALIDADES, isoColombia } from '../talleres/reglas';
import type { Actor } from '../usuarios/actor';
import { historialComponente, pagadorPorCausa } from './reglas';
import type { ResultadoGarantia, ServicioAValidar, TareaHistorial } from './reglas';

// Quien firma en el historial cuando responde el concesionario simulado.
const CONCESIONARIO: Actor = { id: '', nombre: 'Concesionario', apellido: '(simulado)', usuario: 'concesionario', rol: 'agente', tallerId: null };

export const resultadoGarantiaDto = z.object({
  resultados: z
    .array(
      z.object({
        tareaId: z.number().int().positive(),
        valida: z.boolean(),
        motivo: z.string().trim().min(3, 'Explique el motivo de la decisión').max(1000),
      }),
    )
    .min(1),
});

// Envía al concesionario todo lo del diagnóstico. El simulado responde al instante; el
// real responde después con registrar_resultado_garantia.
export async function solicitarValidacion(tx: EntityManager, orden: Orden, tareas: Tarea[], evidencias: Evidencia[]) {
  const deOrden = evidencias.filter((e) => !e.tarea).map((e) => urlEvidencia(e.id));
  const servicios: ServicioAValidar[] = tareas
    .filter((t) => !t.fija)
    .map((t) => ({
      tareaId: t.id,
      sku: t.servicioSku,
      especialidad: t.especialidad,
      causa: t.causa,
      aplica: t.garantiaAplica,
      motivo: t.garantiaMotivo,
      evidencias: [...evidencias.filter((e) => e.tarea?.id === t.id).map((e) => urlEvidencia(e.id)), ...deOrden],
    }));
  const solicitud = {
    codigo: codigoOrden(orden.id),
    idRelacion: orden.relacion.idRelacion,
    vin: orden.relacion.vin,
    porGarantia: orden.porGarantia,
    motivoReclamo: orden.motivoReclamo,
    servicios,
  };
  const resultados = await concesionario().validarGarantia(solicitud);
  if (resultados) return aplicarResultado(tx, orden, resultados, CONCESIONARIO);
  await encolar(tx, 'concesionario', 'validar_garantia', solicitudGarantia(solicitud));
}

// Guarda la respuesta del concesionario y sigue el proceso normal: cotización a
// facturación con el resultado de la garantía en cada línea.
export async function aplicarResultado(tx: EntityManager, orden: Orden, resultados: ResultadoGarantia[], actor: Actor) {
  const tareas = await tx.find(Tarea, { where: { diagnostico: { orden: { id: orden.id } } } });
  const faltan = tareas.filter((t) => !t.fija && !resultados.some((r) => r.tareaId === t.id));
  if (faltan.length) throw invalido(`Falta la respuesta para los servicios ${faltan.map((t) => t.id).join(', ')}`);
  for (const t of tareas) {
    const r = resultados.find((x) => x.tareaId === t.id);
    await tx.update(Tarea, t.id, {
      garantiaValida: r?.valida ?? false,
      garantiaRespuesta: r?.motivo ?? 'Revisión general: no aplica garantía',
      pagador: r?.valida ? pagadorPorCausa(t.causa) : 'cliente',
    });
  }
  const validas = resultados.filter((r) => r.valida).length;
  await transicionar(tx, orden, 'en_cotizacion', actor, `Garantía: ${validas} de ${resultados.length} servicios válidos`);
  await enviarCotizacion(tx, orden);
}

export async function registrarResultadoGarantia(
  actor: Actor,
  codigo: string,
  resultados: ResultadoGarantia[],
  idMensaje?: string,
) {
  return unaVez(idMensaje, 'registrar_resultado_garantia', async () => {
    await (await bd()).transaction(async (tx) => {
      const orden = await cargarOrden(tx, actor, codigo, true);
      if (orden.estado !== 'validando_garantia') {
        throw invalido(`La orden ${codigo} está ${orden.estado}: no espera respuesta de garantía`);
      }
      await aplicarResultado(tx, orden, resultados, actor);
    });
    avisarDespacho();
    return unaOrden(actor, codigo);
  });
}

// ---------- consultar_manipulacion ----------

export const manipulacionDto = z.object({
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'El VIN tiene 17 caracteres, sin I, O ni Q'),
  idRelacion: z.string().trim().toUpperCase().optional(),
  especialidad: z.enum(ESPECIALIDADES),
  sku: z.string().trim().toUpperCase().min(2).optional(),
  excluirCodigo: z.string().trim().optional(),
});

interface FilaHistorial {
  orden_id: number;
  servicio_sku: string;
  especialidad: TareaHistorial['especialidad'];
  causa: TareaHistorial['causa'];
  completada: boolean;
  con_repuestos: boolean;
  texto: string;
  diagnosticado_en: Date;
  reparado_en: Date | null;
}

// ¿Ya se le hizo algo a ese componente del vehículo? El concesionario lo pregunta mientras
// valida una garantía, así que es una sola consulta a la copia local (sin llamar a nadie) y
// no devuelve datos personales.
export async function consultarManipulacion(datos: z.infer<typeof manipulacionDto>) {
  const db = await bd();
  const excluir = datos.excluirCodigo ? numeroOrden(datos.excluirCodigo) : null;
  if (datos.excluirCodigo && !excluir) throw invalido(`excluir_codigo ${datos.excluirCodigo} no es un código de orden (OT-0001)`);
  if (datos.idRelacion) {
    const relacion = await db.getRepository(RelacionVehiculo).findOneBy({ idRelacion: datos.idRelacion });
    if (relacion && relacion.vin.toUpperCase() !== datos.vin) throw invalido(`El VIN ${datos.vin} no corresponde al id_relacion ${datos.idRelacion}`);
  }
  const filas: FilaHistorial[] = await db.query(
    `SELECT o.id AS orden_id, t.servicio_sku, t.especialidad, t.causa, t.completada,
            EXISTS (SELECT 1 FROM diagnostico_repuestos dr WHERE dr.tarea_id = t.id) AS con_repuestos,
            concat_ws(' ', t.descripcion, t.garantia_motivo, d.observaciones) AS texto,
            coalesce(d.finalizado_en, d.creado_en) AS diagnosticado_en,
            coalesce(r.terminada_en, r.iniciada_en) AS reparado_en
       FROM ordenes o
       JOIN relaciones_vehiculo rv ON rv.id_relacion = o.id_relacion
       JOIN diagnosticos d ON d.orden_id = o.id
       JOIN diagnostico_tareas t ON t.diagnostico_id = d.id AND t.fija = false
       LEFT JOIN reparaciones r ON r.orden_id = o.id
      WHERE upper(rv.vin) = $1 AND t.especialidad = $2 AND ($3::varchar IS NULL OR t.servicio_sku = $3)
      ORDER BY o.id`,
    [datos.vin, datos.especialidad, datos.sku ?? null],
  );
  const tareas: TareaHistorial[] = filas.map((f) => ({
    codigo: codigoOrden(f.orden_id),
    actual: f.orden_id === excluir,
    especialidad: f.especialidad,
    sku: f.servicio_sku,
    causa: f.causa,
    completada: f.completada,
    conRepuestos: f.con_repuestos,
    texto: f.texto ?? '',
    fechaDiagnostico: new Date(f.diagnosticado_en),
    fechaReparacion: f.reparado_en ? new Date(f.reparado_en) : null,
  }));
  const historial = historialComponente(tareas, { especialidad: datos.especialidad, sku: datos.sku }, isoColombia);
  return {
    vin: datos.vin,
    especialidad: datos.especialidad,
    sku: datos.sku ?? null,
    excluir_codigo: excluir ? codigoOrden(excluir) : null,
    ...historial,
  };
}
