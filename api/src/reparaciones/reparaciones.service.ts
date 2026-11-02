import type { EntityManager } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { pesos } from '../comun/columnas';
import { invalido, noEncontrado } from '../comun/errores';
import { CompraRepuesto } from '../cotizaciones/compra.entity';
import { manoObraRealizada } from '../cotizaciones/reglas';
import { buscarDiagnostico } from '../diagnosticos/diagnosticos.service';
import { Repuesto } from '../diagnosticos/repuesto.entity';
import { Tarea } from '../diagnosticos/tarea.entity';
import { avisarDespacho, encolar } from '../integraciones/bandeja';
import { asignadoA, cargarOrden, nombreDe, siguientePaso, transicionar } from '../ordenes/ordenes.service';
import type { Orden } from '../ordenes/orden.entity';
import { codigoOrden, esGestion, exigirTrabajo } from '../ordenes/reglas';
import { catalogoServicios } from '../servicios/servicios.service';
import type { Actor } from '../usuarios/actor';
import type { DatosHoras, DatosParte } from './dto';
import { ParteUsada } from './parte-usada.entity';
import { RegistroHoras } from './registro-horas.entity';
import { Reparacion } from './reparacion.entity';
import { eficiencia, horasEntre } from './reglas';

async function buscarReparacion(gestor: EntityManager, ordenId: number) {
  const reparacion = await gestor.findOne(Reparacion, {
    where: { orden: { id: ordenId } },
    relations: { horas: { tarea: true, mecanico: true }, partes: { compra: true } },
  });
  if (!reparacion) throw noEncontrado('La orden todavía no tiene reparación: un mecánico debe tomarla');
  return reparacion;
}

// Abre una transacción, carga la orden y comprueba que se pueda registrar trabajo.
async function enReparacion<T>(
  actor: Actor,
  codigo: string,
  trabajo: (tx: EntityManager, orden: Orden, reparacion: Reparacion) => Promise<T>,
) {
  const resultado = await (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    exigirTrabajo(actor.rol, asignadoA(orden, actor, 'reparacion'), 'reparacion');
    const reparacion = await buscarReparacion(tx, orden.id);
    if (orden.estado !== 'en_reparacion' || reparacion.estado !== 'en_curso') {
      throw invalido(`La orden ${codigo} está ${orden.estado}: no se puede registrar trabajo`);
    }
    return trabajo(tx, orden, reparacion);
  });
  avisarDespacho();
  return resultado;
}

export async function verReparacion(actor: Actor, codigo: string) {
  const db = await bd();
  const orden = await cargarOrden(db.manager, actor, codigo);
  const reparacion = await buscarReparacion(db.manager, orden.id);
  const tareas = (await buscarDiagnostico(orden.id)).tareas;
  const compras = await db.getRepository(CompraRepuesto).find({ where: { orden: { id: orden.id } }, order: { id: 'ASC' } });
  const estandar = new Map((await catalogoServicios(false)).map((s) => [s.sku, s.horasEstandar]));
  const horasReales = pesos(reparacion.horas.reduce((s, h) => s + h.horas, 0));
  const horasEstandar = pesos(tareas.filter((t) => !t.fija).reduce((s, t) => s + (estandar.get(t.servicioSku) ?? 0), 0));
  return {
    orden: codigoOrden(orden.id),
    estado_orden: orden.estado,
    ...siguientePaso(orden.estado),
    estado: reparacion.estado,
    iniciada_en: reparacion.iniciadaEn,
    terminada_en: reparacion.terminadaEn,
    servicios: tareas.map((t) => ({
      id: t.id,
      posicion: t.posicion,
      sku: t.servicioSku,
      servicio: t.servicioNombre,
      descripcion: t.descripcion,
      precio: t.precio,
      pagador: t.pagador,
      garantia_valida: t.garantiaValida,
      completada: t.completada,
      fija: t.fija,
    })),
    orden_compra: compras.map((c) => ({
      id: c.id,
      codigo_repuesto: c.codigoRepuesto,
      descripcion: c.descripcion,
      cantidad: c.cantidad,
      tienda: c.tienda,
      precio_unitario: c.precioUnitario,
      pagador: c.pagador,
    })),
    horas: [...reparacion.horas]
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
      .map((h) => ({
        id: h.id,
        mecanico: nombreDe(h.mecanico),
        mecanico_id: h.mecanico.id,
        tarea_id: h.tarea?.id ?? null,
        inicio: h.inicio,
        fin: h.fin,
        horas: h.horas,
        nota: h.nota,
      })),
    partes_usadas: reparacion.partes.map((p) => ({
      id: p.id,
      codigo_repuesto: p.codigoRepuesto,
      descripcion: p.descripcion,
      cantidad: p.cantidad,
      compra_id: p.compra?.id ?? null,
      tienda: p.compra?.tienda ?? null,
      nota: p.nota,
    })),
    // Las horas son control: estándar de los SKU contra las reales.
    control: { horas_estandar: horasEstandar, horas_reales: horasReales, eficiencia: eficiencia(horasEstandar, horasReales) },
    mano_obra_cotizada: pesos(tareas.reduce((s, t) => s + t.precio, 0)),
    mano_obra_realizada: manoObraRealizada(tareas),
  };
}

export async function registrarHoras(actor: Actor, codigo: string, datos: DatosHoras) {
  await enReparacion(actor, codigo, async (tx, orden, reparacion) => {
    let mecanicoId = actor.id;
    if (datos.mecanicoId && datos.mecanicoId !== actor.id) {
      if (!esGestion(actor.rol)) throw invalido('Solo puede registrar sus propias horas');
      const asignado = orden.asignaciones.some((a) => a.activa && a.etapa === 'reparacion' && a.mecanico.id === datos.mecanicoId);
      if (!asignado) throw invalido('Ese mecánico no está asignado a la reparación');
      mecanicoId = datos.mecanicoId;
    } else if (esGestion(actor.rol)) {
      // Un agente o el administrador registra a nombre del mecánico asignado.
      const asignado = orden.asignaciones.find((a) => a.activa && a.etapa === 'reparacion');
      if (!asignado) throw invalido('La reparación no tiene mecánico asignado');
      mecanicoId = asignado.mecanico.id;
    }
    const inicio = new Date(datos.inicio);
    const fin = new Date(datos.fin);
    const horas = horasEntre(inicio, fin);
    let tarea: Tarea | null = null;
    if (datos.tareaId) {
      tarea = await tx.findOne(Tarea, { where: { id: datos.tareaId, diagnostico: { orden: { id: orden.id } } } });
      if (!tarea) throw invalido('Ese servicio no pertenece al diagnóstico de la orden');
    }
    await tx.save(tx.create(RegistroHoras, { reparacion, mecanico: { id: mecanicoId }, tarea, inicio, fin, horas, nota: datos.nota }));
  });
  return verReparacion(actor, codigo);
}

// Deja constancia de lo usado; no descuenta nada (el taller no tiene inventario).
export async function registrarParteUsada(actor: Actor, codigo: string, datos: DatosParte) {
  await enReparacion(actor, codigo, async (tx, orden, reparacion) => {
    let compra: CompraRepuesto | null = null;
    if (datos.compraId) {
      compra = await tx.findOne(CompraRepuesto, { where: { id: datos.compraId, orden: { id: orden.id } } });
      if (!compra) throw invalido('Esa línea no es de la orden de compra de esta orden');
    }
    const pedido = compra
      ? null
      : await tx.findOne(Repuesto, { where: { codigoRepuesto: datos.codigoRepuesto, tarea: { diagnostico: { orden: { id: orden.id } } } } });
    const descripcion = datos.descripcion || compra?.descripcion || pedido?.descripcion;
    if (!descripcion) throw invalido(`Describa el repuesto ${datos.codigoRepuesto}: no está en el diagnóstico ni en la orden de compra`);
    await tx.save(
      tx.create(ParteUsada, {
        reparacion,
        codigoRepuesto: datos.codigoRepuesto,
        descripcion,
        cantidad: datos.cantidad,
        compra,
        nota: datos.nota,
        registradaPor: { id: actor.id },
      }),
    );
  });
  return verReparacion(actor, codigo);
}

export async function marcarTarea(actor: Actor, codigo: string, tareaId: number, completada: boolean) {
  await enReparacion(actor, codigo, async (tx, orden) => {
    const tarea = await tx.findOne(Tarea, { where: { id: tareaId, diagnostico: { orden: { id: orden.id } } } });
    if (!tarea) throw noEncontrado('Ese servicio no pertenece al diagnóstico de la orden');
    if (tarea.fija) throw invalido(`«${tarea.servicioNombre}» ya se hizo en la revisión general`);
    await tx.update(Tarea, tareaId, { completada });
  });
  return verReparacion(actor, codigo);
}

// Termina la reparación: queda pendiente de facturación y se le avisa a facturación con
// lo que de verdad se hizo y se gastó, para que envíe el PSE.
export async function terminarReparacion(actor: Actor, codigo: string) {
  await enReparacion(actor, codigo, async (tx, orden, reparacion) => {
    if (reparacion.horas.length === 0) throw invalido('Registre las horas trabajadas antes de terminar');
    const tareas = await tx.find(Tarea, { where: { diagnostico: { orden: { id: orden.id } } }, order: { posicion: 'ASC' } });
    const propias = tareas.filter((t) => !t.fija);
    if (!propias.some((t) => t.completada)) throw invalido('Marque como hechos los servicios realizados antes de terminar');
    const total = manoObraRealizada(tareas);
    await tx.update(Reparacion, reparacion.id, { estado: 'terminada', terminadaEn: new Date(), total });
    await transicionar(tx, orden, 'pendiente_facturacion', actor, `Mano de obra realizada ${total}`);
    await encolar(tx, 'facturacion', 'notificar_reparacion_terminada', {
      codigo: codigoOrden(orden.id),
      id_relacion: orden.relacion.idRelacion,
      cotizacion_ref: orden.cotizacionRef,
      mano_obra_realizada: tareas
        .filter((t) => t.completada)
        .map((t) => ({ tarea_id: t.id, sku: t.servicioSku, descripcion: t.servicioNombre, precio: Math.round(t.precio), pagador: t.pagador })),
      servicios_no_realizados: propias
        .filter((t) => !t.completada)
        .map((t) => ({ tarea_id: t.id, sku: t.servicioSku, descripcion: t.servicioNombre })),
      partes_usadas: reparacion.partes.map((p) => ({
        codigo_repuesto: p.codigoRepuesto,
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        compra_id: p.compra?.id ?? null,
        tienda: p.compra?.tienda ?? null,
      })),
      total_mano_obra: Math.round(total),
      responder_con: 'registrar_pago',
    });
  });
  return verReparacion(actor, codigo);
}
