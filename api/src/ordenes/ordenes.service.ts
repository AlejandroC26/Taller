import { In } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import { bd } from '../base-datos/conexion';
import { conflicto, invalido, noEncontrado, prohibido } from '../comun/errores';
import { manoObraRealizada } from '../cotizaciones/reglas';
import { Diagnostico } from '../diagnosticos/diagnostico.entity';
import { avisarDespacho, encolar } from '../integraciones/bandeja';
import { prediagnosticar } from '../prediagnostico/agente';
import type { Prediagnostico } from '../prediagnostico/reglas';
import { aRelacion, descripcionVehiculo, obtenerRelacion } from '../relaciones/relaciones.service';
import { Reparacion } from '../reparaciones/reparacion.entity';
import { catalogoServicios } from '../servicios/servicios.service';
import { exigirFranjaLibre, fechaLocal } from '../talleres/reglas';
import { aTaller, buscarTaller, disponibilidad } from '../talleres/talleres.service';
import { Taller } from '../talleres/taller.entity';
import type { Actor } from '../usuarios/actor';
import { Usuario } from '../usuarios/usuario.entity';
import { Asignacion } from './asignacion.entity';
import { Orden } from './orden.entity';
import {
  ABIERTOS,
  CANCELABLES,
  codigoOrden,
  EN_COLA,
  esGestion,
  etapaAlTomar,
  exigirTransicion,
  numeroOrden,
  paso,
  PASOS,
  puedeVerOrden,
} from './reglas';
import type { Estado, Etapa } from './reglas';

export const nombreDe = (u: { nombre: string; apellido: string }) => `${u.nombre} ${u.apellido}`;

const RELACIONES = {
  relacion: true,
  taller: true,
  remitidaDesde: true,
  asignaciones: { mecanico: true },
  creadaPor: true,
} as const;

export const asignadoA = (orden: Orden, actor: Actor, etapa?: Etapa) =>
  (orden.asignaciones ?? []).some((a) => a.activa && a.mecanico.id === actor.id && (!etapa || a.etapa === etapa));

const ve = (orden: Orden, actor: Actor) =>
  puedeVerOrden(actor.rol, {
    asignado: asignadoA(orden, actor),
    enMiSede: actor.tallerId === orden.taller.id,
    enCola: EN_COLA.includes(orden.estado),
  });

// Carga una orden que el actor puede ver. Con bloquear, toma la fila (FOR UPDATE) para que
// dos cambios al mismo tiempo no se pisen.
export async function cargarOrden(gestor: EntityManager, actor: Actor, codigo: string, bloquear = false): Promise<Orden> {
  const id = numeroOrden(codigo);
  if (id && bloquear) await gestor.query('SELECT id FROM ordenes WHERE id = $1 FOR UPDATE', [id]);
  const orden = id ? await gestor.findOne(Orden, { where: { id }, relations: RELACIONES }) : null;
  if (!orden || !ve(orden, actor)) throw noEncontrado(`No existe la orden ${codigo}`);
  return orden;
}

// Cambia el estado, deja el paso en la línea de tiempo y le avisa al concesionario.
export async function transicionar(tx: EntityManager, orden: Orden, nuevo: Estado, actor: Actor, nota?: string) {
  exigirTransicion(orden.estado, nuevo, codigoOrden(orden.id));
  orden.estado = nuevo;
  orden.historial = [...orden.historial, paso(nuevo, nombreDe(actor), nota)];
  await tx.update(Orden, orden.id, { estado: nuevo, historial: orden.historial });
  await encolar(tx, 'concesionario', 'notificar_estado_vehiculo', {
    codigo: codigoOrden(orden.id),
    id_relacion: orden.relacion.idRelacion,
    placa: orden.relacion.placa,
    sede: orden.taller.nombre,
    estado: nuevo,
    nota: nota ?? null,
    fecha: new Date().toISOString(),
  });
}

// La guía para orquestadores: qué falta, quién debe hacerlo y con qué herramientas.
export const siguientePaso = (estado: Estado) => ({
  siguiente_paso: { responsable: PASOS[estado].responsable, descripcion: PASOS[estado].descripcion },
  acciones_disponibles: [...PASOS[estado].acciones, 'estado_orden'],
});

export const aOrden = (o: Orden) => ({
  codigo: codigoOrden(o.id),
  estado: o.estado,
  ...siguientePaso(o.estado),
  sede: aTaller(o.taller),
  remitida_desde: o.remitidaDesde ? { codigo: o.remitidaDesde.codigo, nombre: o.remitidaDesde.nombre, nota: o.notaRemision } : null,
  ...aRelacion(o.relacion),
  fecha_cita: o.fechaCita,
  kilometraje: o.kilometraje,
  mensajes_cliente: o.mensajesCliente,
  sintomas: o.sintomas,
  prediagnostico: o.prediagnostico,
  por_garantia: o.porGarantia,
  motivo_reclamo: o.motivoReclamo,
  motivo_cancelacion: o.motivoCancelacion,
  cotizacion_ref: o.cotizacionRef,
  pago_ref: o.pagoRef,
  asignaciones: (o.asignaciones ?? [])
    .filter((a) => a.activa)
    .map((a) => ({ id: a.id, etapa: a.etapa, mecanico_id: a.mecanico.id, mecanico: nombreDe(a.mecanico) })),
  historial: o.historial,
  agendada_por: o.creadaPor ? nombreDe(o.creadaPor) : undefined,
  creado_en: o.creadoEn,
  actualizado_en: o.actualizadoEn,
});

export const filtroOrdenesDto = z.object({
  estado: z.enum(['agendada', 'en_diagnostico', 'remitida', 'validando_garantia', 'en_cotizacion', 'aprobada', 'rechazada', 'en_reparacion', 'pendiente_facturacion', 'facturada', 'entregada', 'cancelada']).optional(),
  tallerId: z.number().int().positive().optional(),
  idRelacion: z.string().trim().max(60).optional(),
  abiertas: z.boolean().optional(),
  // Para el mecánico: 'mias' (asignadas) o 'cola' (de su sede, esperando mecánico).
  vista: z.enum(['mias', 'cola', 'todas']).optional(),
});

export async function listarOrdenes(actor: Actor, filtro: z.infer<typeof filtroOrdenesDto> = {}, limite = 100) {
  const consulta = (await bd())
    .getRepository(Orden)
    .createQueryBuilder('o')
    .leftJoinAndSelect('o.relacion', 'r')
    .leftJoinAndSelect('o.taller', 't')
    .leftJoinAndSelect('o.remitidaDesde', 'rd')
    .leftJoinAndSelect('o.asignaciones', 'a')
    .leftJoinAndSelect('a.mecanico', 'm')
    .leftJoinAndSelect('o.creadaPor', 'c')
    .orderBy('o.id', 'DESC')
    .take(limite);
  const mias = 'o.id IN (SELECT orden_id FROM asignaciones WHERE mecanico_id = :yo AND activa)';
  if (actor.rol === 'mecanico') {
    const vista = filtro.vista ?? 'mias';
    const cola = 'o.taller_id = :sede AND o.estado IN (:...cola)';
    if (vista === 'mias') consulta.andWhere(`${mias} AND o.estado IN (:...abiertos)`, { yo: actor.id, abiertos: ABIERTOS });
    else if (vista === 'cola') consulta.andWhere(cola, { sede: actor.tallerId ?? -1, cola: EN_COLA });
    else consulta.andWhere(`(${mias} OR ${cola})`, { yo: actor.id, sede: actor.tallerId ?? -1, cola: EN_COLA });
  }
  if (filtro.estado) consulta.andWhere('o.estado = :estado', { estado: filtro.estado });
  if (filtro.tallerId) consulta.andWhere('o.taller_id = :tid', { tid: filtro.tallerId });
  if (filtro.idRelacion) consulta.andWhere('o.id_relacion = :rel', { rel: filtro.idRelacion.toUpperCase() });
  if (filtro.abiertas) consulta.andWhere('o.estado IN (:...abiertas)', { abiertas: ABIERTOS });
  return (await consulta.getMany()).map(aOrden);
}

// El detalle: la orden con el resumen del diagnóstico y de la reparación.
export async function unaOrden(actor: Actor, codigo: string) {
  const db = await bd();
  const orden = await cargarOrden(db.manager, actor, codigo);
  const diagnostico = await db.getRepository(Diagnostico).findOne({
    where: { orden: { id: orden.id } },
    relations: { tareas: { repuestos: true }, mecanico: true },
  });
  const reparacion = await db.getRepository(Reparacion).findOne({ where: { orden: { id: orden.id } } });
  return {
    ...aOrden(orden),
    diagnostico: diagnostico && {
      estado: diagnostico.estado,
      mecanico: nombreDe(diagnostico.mecanico),
      servicios: diagnostico.tareas.length,
      total_mano_obra: manoObraRealizada(diagnostico.tareas.map((t) => ({ precio: t.precio, completada: true }))),
      repuestos: diagnostico.tareas.reduce((s, t) => s + t.repuestos.length, 0),
    },
    reparacion: reparacion && {
      estado: reparacion.estado,
      iniciada_en: reparacion.iniciadaEn,
      terminada_en: reparacion.terminadaEn,
      total_mano_obra: reparacion.total,
    },
  };
}

// ---------- Citas (las agenda el agente del concesionario) ----------

const mensajes = z.array(z.union([z.string().trim().min(1), z.object({ texto: z.string().trim().min(1), fecha: z.string().optional() })]));

export const prediagnosticarDto = z.object({
  idRelacion: z.string().trim().min(1, 'Falta el id_relacion'),
  mensajesCliente: mensajes.min(1, 'Envíe al menos un mensaje del cliente'),
});

export const citaDto = z.object({
  idRelacion: z.string().trim().min(1, 'Falta el id_relacion'),
  fechaHora: z.iso.datetime({ offset: true, message: 'Fecha y hora ISO 8601 con zona; por ejemplo 2026-10-27T09:00:00-05:00' }),
  taller: z.union([z.number().int().positive(), z.string().trim().min(2)]).optional(),
  mensajesCliente: mensajes.default([]),
  sintomas: z.string().trim().max(2000).default(''),
  kilometraje: z.number().int().min(0).optional(),
  porGarantia: z.boolean().default(false),
  motivoReclamo: z.string().trim().max(1000).optional(),
});

const textoMensajes = (m: z.infer<typeof mensajes>) => m.map((x) => (typeof x === 'string' ? x : x.texto));
const aMensajes = (m: z.infer<typeof mensajes>) =>
  m.map((x) => (typeof x === 'string' ? { texto: x } : { texto: x.texto, ...(x.fecha ? { fecha: x.fecha } : {}) }));

async function sedesCatalogo() {
  return (await bd()).getRepository(Taller).find();
}

// El agente de prediagnóstico, con el catálogo y las sedes reales.
export async function prediagnosticoDe(textos: string[], vehiculo: string): Promise<Prediagnostico> {
  return prediagnosticar(textos, vehiculo, await catalogoServicios(), await sedesCatalogo());
}

export async function consultarPrediagnostico(datos: z.infer<typeof prediagnosticarDto>) {
  const relacion = await obtenerRelacion(datos.idRelacion);
  const pre = await prediagnosticoDe(textoMensajes(datos.mensajesCliente), descripcionVehiculo(relacion));
  const servicios = (await catalogoServicios()).filter((s) => pre.servicios.includes(s.sku));
  return {
    id_relacion: relacion.idRelacion,
    vehiculo: descripcionVehiculo(relacion),
    garantia: relacion.garantia,
    ...pre,
    servicios_probables: servicios.map((s) => ({ sku: s.sku, nombre: s.nombre, precio_mano_obra: s.precioManoObra })),
    sede_sugerida: pre.taller ?? null,
    siguiente_paso: {
      responsable: 'concesionario',
      descripcion:
        pre.ruta === 'especializada'
          ? 'Agende la cita en la sede especializada sugerida (consultar_disponibilidad → agendar_cita)'
          : 'El cliente no sabe qué tiene: agende la cita en la sede de mantenimiento para revisión general',
    },
    acciones_disponibles: ['consultar_disponibilidad', 'agendar_cita'],
  };
}

export async function agendarCita(actor: Actor, datos: z.infer<typeof citaDto>) {
  const db = await bd();
  const relacion = await obtenerRelacion(datos.idRelacion);
  const textos = textoMensajes(datos.mensajesCliente);
  const pre = await prediagnosticoDe(textos.length ? textos : [datos.sintomas], descripcionVehiculo(relacion));
  // Sin sede indicada, va a la que sugiere el prediagnóstico.
  const sede = datos.taller !== undefined ? await buscarTaller(datos.taller) : pre.taller ? await buscarTaller(pre.taller.id) : null;
  if (!sede) throw invalido('No hay sedes activas para agendar');
  if (!sede.activo) throw invalido(`La sede ${sede.nombre} no está activa`);
  const { franjas } = await disponibilidad(sede.id, fechaLocal(datos.fechaHora));
  exigirFranjaLibre(franjas, datos.fechaHora);

  const codigo = await db.transaction(async (tx) => {
    const abierta = await tx.findOne(Orden, { where: { relacion: { idRelacion: relacion.idRelacion }, estado: In([...ABIERTOS]) } });
    if (abierta) throw conflicto(`El vehículo ya tiene la orden ${codigoOrden(abierta.id)} abierta`);
    const orden = await tx.save(
      tx.create(Orden, {
        relacion,
        taller: sede,
        fechaCita: new Date(datos.fechaHora),
        mensajesCliente: aMensajes(datos.mensajesCliente),
        sintomas: datos.sintomas || textos.join(' '),
        prediagnostico: pre,
        kilometraje: datos.kilometraje ?? relacion.kilometraje,
        porGarantia: datos.porGarantia,
        motivoReclamo: datos.porGarantia ? (datos.motivoReclamo ?? 'Reclamo de garantía') : null,
        creadaPor: { id: actor.id },
        historial: [paso('agendada', nombreDe(actor), `Cita en ${sede.nombre}${datos.porGarantia ? ' — por garantía' : ''}`)],
      }),
    );
    orden.relacion = relacion;
    orden.taller = sede;
    await encolar(tx, 'concesionario', 'notificar_estado_vehiculo', {
      codigo: codigoOrden(orden.id),
      id_relacion: relacion.idRelacion,
      placa: relacion.placa,
      sede: sede.nombre,
      estado: 'agendada',
      nota: null,
      fecha: new Date().toISOString(),
    });
    return codigoOrden(orden.id);
  });
  avisarDespacho();
  return unaOrden(actor, codigo);
}

export async function cancelarCita(actor: Actor, codigo: string, motivo: string) {
  await (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    if (!esGestion(actor.rol)) throw prohibido('Solo la gestión o el concesionario cancelan una orden');
    if (!CANCELABLES.includes(orden.estado)) {
      throw invalido(`La orden ${codigo} está ${orden.estado}: ya no se puede cancelar`);
    }
    await transicionar(tx, orden, 'cancelada', actor, motivo);
    await tx.update(Orden, orden.id, { motivoCancelacion: motivo });
    await tx.update(Diagnostico, { orden: { id: orden.id }, estado: 'borrador' }, { estado: 'cancelado' });
    await tx.update(Asignacion, { orden: { id: orden.id }, activa: true }, { activa: false });
  });
  avisarDespacho();
  return unaOrden(actor, codigo);
}

// ---------- Tomar una orden de la cola de la sede ----------

// El mecánico la toma para él. La gestión puede asignarla a un mecánico de la sede.
export async function tomarOrden(actor: Actor, codigo: string, mecanicoId?: string) {
  await (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    const { etapa, pasaA } = etapaAlTomar(orden.estado, codigo);
    let mecanico: Usuario | null;
    if (actor.rol === 'mecanico') {
      if (mecanicoId && mecanicoId !== actor.id) throw prohibido('Un mecánico solo toma órdenes para sí mismo');
      mecanico = await tx.findOneBy(Usuario, { id: actor.id });
    } else {
      if (!mecanicoId) throw invalido('Indique el mecanico_id que tomará la orden');
      mecanico = await tx.findOneBy(Usuario, { id: mecanicoId });
    }
    if (!mecanico || !mecanico.activo || mecanico.rol.nombre !== 'mecanico') throw invalido('Ese usuario no es un mecánico activo');
    if (mecanico.taller?.id !== orden.taller.id) {
      throw invalido(`El mecánico no pertenece a la sede ${orden.taller.nombre}, donde está la orden`);
    }
    await tx.save(tx.create(Asignacion, { orden, mecanico, etapa, asignadoPor: { id: actor.id } }));
    if (etapa === 'diagnostico') {
      const diagnostico = await tx.findOne(Diagnostico, { where: { orden: { id: orden.id } } });
      if (!diagnostico) await tx.save(tx.create(Diagnostico, { orden, mecanico, observaciones: '' }));
      else await tx.update(Diagnostico, diagnostico.id, { mecanico: { id: mecanico.id } });
    } else if (!(await tx.existsBy(Reparacion, { orden: { id: orden.id } }))) {
      await tx.save(tx.create(Reparacion, { orden }));
    }
    await transicionar(tx, orden, pasaA, actor, `La toma ${nombreDe(mecanico)} (${etapa})`);
  });
  avisarDespacho();
  return unaOrden(actor, codigo);
}

// El vehículo sale del taller: pagado, o rechazado sin reparar.
export async function registrarSalida(actor: Actor, codigo: string, nota?: string) {
  await (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    if (!esGestion(actor.rol)) throw prohibido('La salida la registra la gestión del taller');
    await transicionar(tx, orden, 'entregada', actor, nota ?? (orden.estado === 'rechazada' ? 'Sale sin reparar' : 'Sale pagado'));
    await tx.update(Asignacion, { orden: { id: orden.id }, activa: true }, { activa: false });
  });
  avisarDespacho();
  return unaOrden(actor, codigo);
}
