import { In } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import { bd } from '../base-datos/conexion';
import { conflicto, invalido, noDisponible, noEncontrado, prohibido } from '../comun/errores';
import { manoObraRealizada } from '../cotizaciones/reglas';
import { Diagnostico } from '../diagnosticos/diagnostico.entity';
import { avisarDespacho, encolar } from '../integraciones/bandeja';
import { conKilometraje, garantiaProbable } from '../garantias/reglas';
import { prediagnosticar } from '../prediagnostico/agente';
import { PrediagnosticoGuardado } from '../prediagnostico/prediagnostico.entity';
import { codigoPrediagnostico, motivoDecision, numeroPrediagnostico } from '../prediagnostico/reglas';
import type { Prediagnostico } from '../prediagnostico/reglas';
import { aRelacion, descripcionVehiculo, obtenerRelacion } from '../relaciones/relaciones.service';
import { Reparacion } from '../reparaciones/reparacion.entity';
import { catalogoServicios } from '../servicios/servicios.service';
import { codigoReserva, exigirFranjaLibre, fechaLocal, isoColombia } from '../talleres/reglas';
import { ReservaFranja } from '../talleres/reserva.entity';
import { aTaller, buscarTaller, disponibilidad, reservaParaAgendar } from '../talleres/talleres.service';
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
  // En hora de Colombia (-05:00), como la pidió el concesionario.
  fecha_cita: o.fechaCita ? isoColombia(o.fechaCita) : null,
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

export const prediagnosticarDto = z
  .object({
    idRelacion: z.string().trim().min(1, 'Falta el id_relacion'),
    mensajesCliente: mensajes.optional(),
    vin: z.string().trim().toUpperCase().length(17, 'El VIN tiene 17 caracteres').optional(),
    porGarantia: z.boolean().optional(),
    motivoReclamo: z.string().trim().min(1).max(1000).optional(),
    kilometraje: z.number().int().min(0).optional(),
  })
  .refine((d) => (d.mensajesCliente?.length ?? 0) > 0 || !!d.motivoReclamo, {
    message: 'Envíe al menos un mensaje del cliente o el motivo del reclamo',
    path: ['mensajesCliente'],
  });

export const citaDto = z
  .object({
    idRelacion: z.string().trim().min(1, 'Falta el id_relacion'),
    fechaHora: z.iso.datetime({ offset: true, message: 'Fecha y hora ISO 8601 con zona; por ejemplo 2026-10-27T09:00:00-05:00' }).optional(),
    taller: z.union([z.number().int().positive(), z.string().trim().min(2)]).optional(),
    idPrediagnostico: z.string().trim().min(1).optional(),
    idReserva: z.string().trim().min(1).optional(),
    mensajesCliente: mensajes.default([]),
    sintomas: z.string().trim().max(2000).default(''),
    kilometraje: z.number().int().min(0).optional(),
    porGarantia: z.boolean().optional(),
    motivoReclamo: z.string().trim().max(1000).optional(),
  })
  .refine((d) => !!d.fechaHora || !!d.idReserva, { message: 'Envíe fecha_hora o id_reserva', path: ['fechaHora'] });

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

// El concesionario pidió respuesta en menos de 30 s. El modelo tiene como máximo 22 s
// (tiempoModeloMs) y después responden las reglas; si aun así algo se demora más (el
// concesionario real, la base), es mejor un error claro que un corte de conexión.
export const PLAZO_PREDIAGNOSTICO_MS = 28_000;

export async function consultarPrediagnostico(datos: z.infer<typeof prediagnosticarDto>, plazoMs = PLAZO_PREDIAGNOSTICO_MS) {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const vencido = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(noDisponible('No se pudo calcular el prediagnóstico a tiempo, intente de nuevo')), plazoMs);
  });
  try {
    return await Promise.race([armarPrediagnostico(datos), vencido]);
  } finally {
    clearTimeout(reloj);
  }
}

async function armarPrediagnostico(datos: z.infer<typeof prediagnosticarDto>) {
  const relacion = await obtenerRelacion(datos.idRelacion);
  if (datos.vin && datos.vin !== relacion.vin.toUpperCase()) {
    throw invalido(`El VIN ${datos.vin} no corresponde al id_relacion ${relacion.idRelacion}`);
  }
  const mensajesCliente = datos.mensajesCliente ?? [];
  const porGarantia = datos.porGarantia ?? false;
  // El motivo del reclamo también describe la falla: el modelo lo lee con los mensajes.
  const textos = [...(datos.motivoReclamo ? [datos.motivoReclamo] : []), ...textoMensajes(mensajesCliente)];
  const pre = await prediagnosticoDe(textos, descripcionVehiculo(relacion));
  const servicios = (await catalogoServicios()).filter((s) => pre.servicios.includes(s.sku));
  // La sede completa, con su ubicación y horario, para que el concesionario se la muestre al cliente.
  const entidad = pre.taller ? await buscarTaller(pre.taller.id) : null;
  const sede = entidad ? aTaller(entidad) : null;
  const guardado = await (await bd()).getRepository(PrediagnosticoGuardado).save({
    relacion,
    taller: entidad,
    resultado: pre,
    mensajesCliente: aMensajes(mensajesCliente.length ? mensajesCliente : textos),
    porGarantia,
    motivoReclamo: datos.motivoReclamo ?? (porGarantia ? 'Reclamo de garantía' : null),
    kilometraje: datos.kilometraje ?? null,
  });
  const { taller: _sedeCorta, ...resultado } = pre;
  return {
    id_prediagnostico: codigoPrediagnostico(guardado.id),
    id_relacion: relacion.idRelacion,
    vehiculo: descripcionVehiculo(relacion),
    ...resultado,
    taller: sede,
    motivo_decision: motivoDecision(pre, sede, servicios.map((s) => s.nombre)),
    garantia: garantiaProbable(conKilometraje(relacion.garantia, datos.kilometraje), pre.especialidad, textos.join(' ')),
    por_garantia: porGarantia,
    motivo_reclamo: guardado.motivoReclamo,
    servicios_probables: servicios.map((s) => ({ sku: s.sku, nombre: s.nombre, precio_mano_obra: s.precioManoObra })),
    // Igual que taller; se conserva para los clientes que ya la leían.
    sede_sugerida: sede,
    siguiente_paso: {
      responsable: 'concesionario',
      descripcion: sede
        ? `Consultar disponibilidad en ${sede.codigo} (consultar_disponibilidad con desde y hasta), apartar la hora con reservar_franja y agendar con agendar_cita enviando id_prediagnostico`
        : 'No hay sedes activas para agendar: avise al taller',
    },
    acciones_disponibles: sede ? ['consultar_disponibilidad', 'reservar_franja', 'agendar_cita'] : [],
  };
}

// El prediagnóstico con el que se va a agendar: debe ser del mismo vehículo.
async function prediagnosticoParaAgendar(codigo: string, idRelacion: string): Promise<PrediagnosticoGuardado> {
  const id = numeroPrediagnostico(codigo);
  const guardado = id
    ? await (await bd()).getRepository(PrediagnosticoGuardado).findOne({ where: { id }, relations: { relacion: true, taller: true } })
    : null;
  if (!guardado) throw noEncontrado(`No existe el prediagnóstico ${codigo}`);
  if (guardado.relacion.idRelacion !== idRelacion) {
    throw invalido(`El prediagnóstico ${codigoPrediagnostico(guardado.id)} es de otro id_relacion`);
  }
  return guardado;
}

export async function agendarCita(actor: Actor, datos: z.infer<typeof citaDto>) {
  const db = await bd();
  const relacion = await obtenerRelacion(datos.idRelacion);
  const guardado = datos.idPrediagnostico ? await prediagnosticoParaAgendar(datos.idPrediagnostico, relacion.idRelacion) : null;
  const reserva = datos.idReserva ? await reservaParaAgendar(datos.idReserva, relacion.idRelacion) : null;
  if (reserva && datos.fechaHora && new Date(datos.fechaHora).getTime() !== reserva.fechaHora.getTime()) {
    throw invalido(`La reserva ${codigoReserva(reserva.id)} es para ${isoColombia(reserva.fechaHora)}, no para ${datos.fechaHora}`);
  }
  const fechaHora = datos.fechaHora ?? isoColombia(reserva!.fechaHora);
  const mensajesCliente = datos.mensajesCliente.length ? datos.mensajesCliente : (guardado?.mensajesCliente ?? []);
  const textos = textoMensajes(mensajesCliente);
  // Con id_prediagnostico se usa lo que ya se le dijo al cliente: no se vuelve a llamar al modelo.
  const pre = guardado?.resultado ?? (await prediagnosticoDe(textos.length ? textos : [datos.sintomas], descripcionVehiculo(relacion)));
  const porGarantia = datos.porGarantia ?? guardado?.porGarantia ?? false;
  const motivoReclamo = datos.motivoReclamo ?? guardado?.motivoReclamo ?? undefined;
  // La sede: la indicada, si no la de la reserva y si no la del prediagnóstico.
  const idSede = datos.taller ?? reserva?.taller.id ?? pre.taller?.id;
  const sede = idSede !== undefined ? await buscarTaller(idSede) : null;
  if (!sede) throw invalido('No hay sedes activas para agendar');
  if (!sede.activo) throw invalido(`La sede ${sede.nombre} no está activa`);
  if (reserva && reserva.taller.id !== sede.id) {
    throw invalido(`La reserva ${codigoReserva(reserva.id)} es en ${reserva.taller.nombre}, no en ${sede.nombre}`);
  }
  // Antes que la franja: si el vehículo ya tiene una orden abierta, ese es el motivo que el
  // cliente debe oír (dentro de la transacción se vuelve a revisar, por si llegan dos a la vez).
  const yaAbierta = await db.getRepository(Orden).findOne({ where: { relacion: { idRelacion: relacion.idRelacion }, estado: In([...ABIERTOS]) } });
  if (yaAbierta) throw conflicto(`El vehículo ya tiene la orden ${codigoOrden(yaAbierta.id)} abierta`);
  // La hora que este vehículo apartó no cuenta como ocupada para él.
  const { franjas } = await disponibilidad(sede.id, fechaLocal(fechaHora), relacion.idRelacion);
  exigirFranjaLibre(franjas, fechaHora);

  const codigo = await db.transaction(async (tx) => {
    const abierta = await tx.findOne(Orden, { where: { relacion: { idRelacion: relacion.idRelacion }, estado: In([...ABIERTOS]) } });
    if (abierta) throw conflicto(`El vehículo ya tiene la orden ${codigoOrden(abierta.id)} abierta`);
    const orden = await tx.save(
      tx.create(Orden, {
        relacion,
        taller: sede,
        fechaCita: new Date(fechaHora),
        mensajesCliente: aMensajes(mensajesCliente),
        sintomas: datos.sintomas || textos.join(' '),
        prediagnostico: pre,
        kilometraje: datos.kilometraje ?? guardado?.kilometraje ?? relacion.kilometraje,
        porGarantia,
        motivoReclamo: porGarantia ? (motivoReclamo ?? 'Reclamo de garantía') : null,
        creadaPor: { id: actor.id },
        historial: [paso('agendada', nombreDe(actor), `Cita en ${sede.nombre}${porGarantia ? ' — por garantía' : ''}`)],
      }),
    );
    // Con la cita creada, las horas que este vehículo tenía apartadas ya no hacen falta.
    await tx
      .createQueryBuilder()
      .update(ReservaFranja)
      .set({ usada: true })
      .where('id_relacion = :rel AND usada = false', { rel: relacion.idRelacion })
      .execute();
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
