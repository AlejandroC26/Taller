import type { EntityManager } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { pesos } from '../comun/columnas';
import { invalido, noDisponible, noEncontrado } from '../comun/errores';
import { dictamenSugerido, NOMBRE_CAUSA } from '../garantias/reglas';
import { solicitarValidacion } from '../garantias/garantias.service';
import { avisarDespacho } from '../integraciones/bandeja';
import { tiendas } from '../integraciones/tiendas';
import { Asignacion } from '../ordenes/asignacion.entity';
import { Orden } from '../ordenes/orden.entity';
import { asignadoA, cargarOrden, nombreDe, transicionar, unaOrden } from '../ordenes/ordenes.service';
import { codigoOrden, exigirTrabajo } from '../ordenes/reglas';
import { catalogoServicios } from '../servicios/servicios.service';
import { buscarTaller } from '../talleres/talleres.service';
import type { Actor } from '../usuarios/actor';
import { Diagnostico } from './diagnostico.entity';
import type { DatosDiagnostico } from './dto';
import { Evidencia } from './evidencia.entity';
import { urlEvidencia } from './evidencias.service';
import { Repuesto } from './repuesto.entity';
import { categoriasDe, exigirListoParaFinalizar, filtrarCatalogo } from './reglas';
import { Tarea } from './tarea.entity';

// El SKU que se cobra cuando una orden pasa por la revisión general antes de remitirse.
export const SKU_REVISION = 'REV-GENERAL';

export async function buscarDiagnostico(ordenId: number, gestor?: EntityManager) {
  const diagnostico = await (gestor ?? (await bd()).manager).findOne(Diagnostico, {
    where: { orden: { id: ordenId } },
    relations: { tareas: { repuestos: true }, mecanico: true },
  });
  if (!diagnostico) throw noEncontrado('La orden todavía no tiene diagnóstico: un mecánico debe tomarla');
  diagnostico.tareas.sort((a, b) => a.posicion - b.posicion);
  return diagnostico;
}

export const aTarea = (t: Tarea, evidencias: Evidencia[] = []) => ({
  id: t.id,
  posicion: t.posicion,
  sku: t.servicioSku,
  servicio: t.servicioNombre,
  especialidad: t.especialidad,
  precio: t.precio,
  descripcion: t.descripcion,
  causa: t.causa,
  causa_nombre: t.causa ? NOMBRE_CAUSA[t.causa] : null,
  garantia: {
    aplica: t.garantiaAplica,
    motivo: t.garantiaMotivo,
    valida: t.garantiaValida,
    respuesta: t.garantiaRespuesta,
    pagador: t.pagador,
  },
  completada: t.completada,
  fija: t.fija,
  repuestos: t.repuestos.map((r) => ({
    id: r.id,
    codigo_repuesto: r.codigoRepuesto,
    descripcion: r.descripcion,
    categoria: r.categoria,
    cantidad: r.cantidad,
  })),
  evidencias: evidencias
    .filter((e) => e.tarea?.id === t.id)
    .map((e) => ({ id: e.id, nombre: e.nombre, tipo: e.tipo, url: urlEvidencia(e.id) })),
});

export async function verDiagnostico(actor: Actor, codigo: string) {
  const db = await bd();
  const orden = await cargarOrden(db.manager, actor, codigo);
  const d = await buscarDiagnostico(orden.id);
  const evidencias = await db.getRepository(Evidencia).find({ where: { orden: { id: orden.id } }, relations: { tarea: true } });
  return {
    orden: codigoOrden(orden.id),
    estado_orden: orden.estado,
    estado: d.estado,
    mecanico: nombreDe(d.mecanico),
    observaciones: d.observaciones,
    por_garantia: orden.porGarantia,
    motivo_reclamo: orden.motivoReclamo,
    garantia_vehiculo: orden.relacion.garantia,
    servicios: d.tareas.map((t) => aTarea(t, evidencias)),
    evidencias_orden: evidencias
      .filter((e) => !e.tarea)
      .map((e) => ({ id: e.id, nombre: e.nombre, tipo: e.tipo, url: urlEvidencia(e.id) })),
    total_mano_obra: pesos(d.tareas.reduce((s, t) => s + t.precio, 0)),
    repuestos_a_comprar: d.tareas.reduce((s, t) => s + t.repuestos.length, 0),
    finalizado_en: d.finalizadoEn,
  };
}

// Abre la transacción, carga la orden y exige que el actor pueda diagnosticar.
async function enDiagnostico<T>(actor: Actor, codigo: string, trabajo: (tx: EntityManager, orden: Orden, d: Diagnostico) => Promise<T>) {
  return (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    exigirTrabajo(actor.rol, asignadoA(orden, actor, 'diagnostico'), 'diagnostico');
    if (orden.estado !== 'en_diagnostico') {
      throw invalido(`La orden ${codigo} está ${orden.estado}: el diagnóstico ya no se puede cambiar`);
    }
    const d = await buscarDiagnostico(orden.id, tx);
    if (d.estado !== 'borrador') throw invalido('El diagnóstico ya fue finalizado');
    return trabajo(tx, orden, d);
  });
}

// Repuestos del catálogo de las tiendas, por código universal. El catálogo se pide al agente
// de cada tienda una vez y se guarda unos minutos; aquí solo se filtra.
export async function buscarRepuestosParaOrden(actor: Actor, codigo: string, filtro: { texto?: string; categoria?: string; refrescar?: boolean } = {}) {
  const orden = await cargarOrden((await bd()).manager, actor, codigo);
  const proveedor = tiendas();
  const catalogo = await proveedor.catalogo({ refrescar: filtro.refrescar });
  if (!catalogo.repuestos.length && catalogo.sin_respuesta.length) {
    throw noDisponible(`La tienda no respondió (${catalogo.sin_respuesta.join(', ')}): intente de nuevo en un momento`);
  }
  return {
    orden: codigoOrden(orden.id),
    tiendas: proveedor.nombres,
    sin_respuesta: catalogo.sin_respuesta,
    actualizado_en: catalogo.actualizado_en,
    categorias: categoriasDe(catalogo.repuestos),
    repuestos: filtrarCatalogo(catalogo.repuestos, filtro.texto, filtro.categoria),
  };
}

type Copia = Pick<Repuesto, 'codigoRepuesto' | 'descripcion' | 'categoria'>;

// Nombre y categoría de cada código elegido. Los que ya estaban guardados no se vuelven a
// revisar; los nuevos deben estar en el catálogo de la tienda. Se hace fuera de la
// transacción: la tienda puede tardar y no debe dejar filas bloqueadas.
export async function copiasDelCatalogo(datos: DatosDiagnostico, guardados: Repuesto[]): Promise<Map<string, Copia>> {
  const copias = new Map<string, Copia>(guardados.map((r) => [r.codigoRepuesto, r]));
  const faltan = [...new Set(datos.tareas.flatMap((t) => t.repuestos.map((r) => r.codigoRepuesto)))].filter((c) => !copias.has(c));
  if (!faltan.length) return copias;
  const catalogo = await tiendas().catalogo();
  const porCodigo = new Map(catalogo.repuestos.map((r) => [r.codigo_repuesto, r]));
  for (const codigoRepuesto of faltan) {
    const r = porCodigo.get(codigoRepuesto);
    if (!r && !catalogo.repuestos.length && catalogo.sin_respuesta.length) {
      throw noDisponible(`La tienda no respondió (${catalogo.sin_respuesta.join(', ')}): intente guardar de nuevo en un momento`);
    }
    if (!r) throw invalido(`El repuesto ${codigoRepuesto} no está en el catálogo de la tienda: búsquelo con buscar_repuestos_tienda`);
    copias.set(codigoRepuesto, { codigoRepuesto, descripcion: r.nombre, categoria: r.categoria });
  }
  return copias;
}

// Guarda el borrador. Los servicios con id se actualizan, los nuevos se crean y los que
// faltan se borran; los fijos (la revisión general) no se tocan.
export async function guardarDiagnostico(actor: Actor, codigo: string, datos: DatosDiagnostico) {
  const catalogo = new Map((await catalogoServicios()).map((s) => [s.sku, s]));
  const db = await bd();
  const previo = await buscarDiagnostico((await cargarOrden(db.manager, actor, codigo)).id);
  const copias = await copiasDelCatalogo(datos, previo.tareas.flatMap((t) => t.repuestos));
  await enDiagnostico(actor, codigo, async (tx, _orden, d) => {
    const existentes = new Map(d.tareas.map((t) => [t.id, t]));
    const fijas = d.tareas.filter((t) => t.fija);
    const enviados = new Set(datos.tareas.map((t) => t.id).filter(Boolean));

    for (const t of d.tareas) {
      if (!t.fija && !enviados.has(t.id)) await tx.delete(Tarea, t.id);
    }
    await tx.update(Diagnostico, d.id, {
      observaciones: datos.observaciones,
      ...(actor.rol === 'mecanico' ? { mecanico: { id: actor.id } } : {}),
    });

    for (const [i, t] of datos.tareas.entries()) {
      const servicio = catalogo.get(t.sku);
      if (!servicio) throw invalido(`No existe el servicio ${t.sku} en el catálogo`);
      const previa = t.id ? existentes.get(t.id) : undefined;
      if (t.id && !previa) throw invalido(`El servicio ${t.id} no pertenece a este diagnóstico`);
      if (previa?.fija) throw invalido(`«${previa.servicioNombre}» lo puso el sistema y no se puede cambiar`);
      const campos = {
        posicion: fijas.length + i + 1,
        servicioSku: servicio.sku,
        servicioNombre: servicio.nombre,
        especialidad: servicio.especialidad,
        precio: servicio.precioManoObra,
        descripcion: t.descripcion,
        causa: t.causa,
        garantiaAplica: t.garantiaAplica ?? dictamenSugerido(t.causa),
        garantiaMotivo: t.garantiaMotivo,
        garantiaValida: null,
        garantiaRespuesta: null,
      };
      const tarea = previa
        ? (await tx.update(Tarea, previa.id, campos), previa)
        : await tx.save(tx.create(Tarea, { ...campos, diagnostico: { id: d.id } }));
      await tx.delete(Repuesto, { tarea: { id: tarea.id } });
      for (const r of t.repuestos) {
        const c = copias.get(r.codigoRepuesto)!;
        await tx.save(
          tx.create(Repuesto, {
            tarea: { id: tarea.id },
            codigoRepuesto: c.codigoRepuesto,
            descripcion: c.descripcion,
            categoria: c.categoria,
            cantidad: r.cantidad,
          }),
        );
      }
    }
  });
  return verDiagnostico(actor, codigo);
}

// Cierra el diagnóstico y lo envía al concesionario para validar la garantía. Toda orden
// pasa por aquí: así al cliente siempre se le avisa qué va por garantía y qué no.
export async function finalizarDiagnostico(actor: Actor, codigo: string) {
  await enDiagnostico(actor, codigo, async (tx, orden, d) => {
    const evidencias = await tx.find(Evidencia, { where: { orden: { id: orden.id } }, relations: { tarea: true } });
    exigirListoParaFinalizar(
      d.tareas.map((t) => ({ ...t, evidencias: evidencias.filter((e) => e.tarea?.id === t.id).length })),
      orden.porGarantia,
      evidencias.length,
    );
    await tx.update(Diagnostico, d.id, { estado: 'finalizado', finalizadoEn: new Date() });
    await transicionar(tx, orden, 'validando_garantia', actor, 'Diagnóstico enviado al concesionario para validar la garantía');
    await solicitarValidacion(tx, orden, d.tareas, evidencias);
  });
  avisarDespacho();
  return verDiagnostico(actor, codigo);
}

// La sede de mantenimiento hizo la revisión general y la pasa al especialista. La
// revisión queda como servicio fijo (se cobra junto con la especialidad).
export async function remitirOrden(actor: Actor, codigo: string, destino: number | string, nota: string) {
  const sede = await buscarTaller(destino);
  const revision = (await catalogoServicios()).find((s) => s.sku === SKU_REVISION);
  await enDiagnostico(actor, codigo, async (tx, orden, d) => {
    if (sede.id === orden.taller.id) throw invalido('La orden ya está en esa sede');
    if (!sede.activo || sede.tipo !== 'especializado') throw invalido(`${sede.nombre} no es una sede especializada activa`);
    if (revision && orden.taller.tipo === 'mantenimiento' && !d.tareas.some((t) => t.servicioSku === SKU_REVISION)) {
      await tx.save(
        tx.create(Tarea, {
          diagnostico: { id: d.id },
          posicion: 0,
          servicioSku: revision.sku,
          servicioNombre: revision.nombre,
          especialidad: revision.especialidad,
          precio: revision.precioManoObra,
          descripcion: `Revisión en ${orden.taller.nombre}: ${nota}`,
          causa: null,
          garantiaAplica: false,
          completada: true,
          fija: true,
        }),
      );
    }
    await tx.update(Asignacion, { orden: { id: orden.id }, etapa: 'diagnostico', activa: true }, { activa: false });
    await tx.update(Orden, orden.id, { taller: { id: sede.id }, remitidaDesde: { id: orden.taller.id }, notaRemision: nota });
    const origen = orden.taller.nombre;
    orden.taller = sede;
    await transicionar(tx, orden, 'remitida', actor, `Remitida de ${origen} a ${sede.nombre}: ${nota}`);
  });
  avisarDespacho();
  // El mecánico que remite ya no la ve (está en otra sede): se responde con la gestión.
  return unaOrden({ ...actor, rol: 'agente' }, codigo);
}
