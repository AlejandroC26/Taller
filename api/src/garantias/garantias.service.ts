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
import { unaVez } from '../integraciones/idempotencia';
import type { Orden } from '../ordenes/orden.entity';
import { cargarOrden, transicionar, unaOrden } from '../ordenes/ordenes.service';
import { codigoOrden } from '../ordenes/reglas';
import type { Actor } from '../usuarios/actor';
import { pagadorPorCausa } from './reglas';
import type { ResultadoGarantia, ServicioAValidar } from './reglas';

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
  await encolar(tx, 'concesionario', 'validar_garantia', {
    codigo: solicitud.codigo,
    id_relacion: solicitud.idRelacion,
    vin: solicitud.vin,
    por_garantia: solicitud.porGarantia,
    motivo_reclamo: solicitud.motivoReclamo,
    servicios: servicios.map((s) => ({
      tarea_id: s.tareaId,
      sku: s.sku,
      especialidad: s.especialidad,
      causa: s.causa,
      aplica: s.aplica,
      motivo: s.motivo,
      evidencias: s.evidencias,
    })),
    responder_con: 'registrar_resultado_garantia',
  });
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
