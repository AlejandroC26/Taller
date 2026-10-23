import { In } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { aVehiculo } from '../clientes/clientes.service';
import { Vehiculo } from '../clientes/vehiculo.entity';
import type { Origen } from '../clientes/vehiculo.entity';
import { TARIFA_HORA } from '../config';
import { conflicto, invalido, noEncontrado } from '../comun/errores';
import { Diagnostico } from '../diagnosticos/diagnostico.entity';
import { costoEstimado } from '../diagnosticos/reglas';
import { avisarDespacho, encolar } from '../integraciones/bandeja';
import { Reparacion } from '../reparaciones/reparacion.entity';
import type { Actor } from '../usuarios/actor';
import { Usuario } from '../usuarios/usuario.entity';
import { Asignacion } from './asignacion.entity';
import type { NuevaOrden } from './dto';
import { Orden } from './orden.entity';
import {
  ABIERTOS,
  cargaPorMecanico,
  codigoOrden,
  estadoTrasAsignar,
  exigirTransicion,
  numeroOrden,
  paso,
  puedeVerOrden,
} from './reglas';
import type { Estado, Etapa, FilaCarga } from './reglas';

export const nombreDe = (u: { nombre: string; apellido: string }) => `${u.nombre} ${u.apellido}`;

const RELACIONES = {
  vehiculo: { cliente: true },
  asignaciones: { mecanico: true },
  creadaPor: true,
} as const;

export const asignadoA = (orden: Orden, actor: Actor, etapa?: Etapa) =>
  orden.asignaciones.some(
    (a) => a.activa && a.mecanico.id === actor.id && (!etapa || a.etapa === etapa),
  );

// Carga una orden que el actor puede ver. Con bloquear, toma la fila (FOR UPDATE) para
// que dos cambios de estado al mismo tiempo no se pisen.
export async function cargarOrden(
  gestor: EntityManager,
  actor: Actor,
  codigo: string,
  bloquear = false,
): Promise<Orden> {
  const id = numeroOrden(codigo);
  if (id && bloquear) await gestor.query('SELECT id FROM ordenes WHERE id = $1 FOR UPDATE', [id]);
  const orden = id ? await gestor.findOne(Orden, { where: { id }, relations: RELACIONES }) : null;
  if (!orden || !puedeVerOrden(actor.rol, { asignado: asignadoA(orden, actor), origen: orden.origen })) {
    throw noEncontrado(`No existe la orden ${codigo}`);
  }
  return orden;
}

// Cambia el estado, deja el paso en la línea de tiempo y, si el carro es del
// concesionario, le avisa.
export async function transicionar(
  tx: EntityManager,
  orden: Orden,
  nuevo: Estado,
  actor: Actor,
  nota?: string,
) {
  exigirTransicion(orden.estado, nuevo, codigoOrden(orden.id));
  orden.estado = nuevo;
  orden.historial = [...orden.historial, paso(nuevo, nombreDe(actor), nota)];
  await tx.update(Orden, orden.id, { estado: nuevo, historial: orden.historial });
  if (orden.origen === 'concesionario') {
    await encolar(tx, 'concesionario', 'notificar_estado_vehiculo', {
      referencia_externa: orden.vehiculo.referenciaExterna,
      placa: orden.vehiculo.placa,
      orden: codigoOrden(orden.id),
      estado: nuevo,
      nota: nota ?? null,
      fecha: new Date().toISOString(),
    });
  }
}

export const aOrden = (o: Orden) => ({
  codigo: codigoOrden(o.id),
  estado: o.estado,
  motivo: o.motivo,
  kilometraje: o.kilometraje,
  origen: o.origen,
  motivoCancelacion: o.motivoCancelacion,
  vehiculo: aVehiculo(o.vehiculo),
  cliente: o.vehiculo.cliente && {
    id: o.vehiculo.cliente.id,
    nombre: nombreDe(o.vehiculo.cliente),
    documento: o.vehiculo.cliente.documento,
    telefono: o.vehiculo.cliente.telefono,
  },
  asignaciones: (o.asignaciones ?? [])
    .filter((a) => a.activa)
    .map((a) => ({ id: a.id, etapa: a.etapa, mecanicoId: a.mecanico.id, mecanico: nombreDe(a.mecanico) })),
  historial: o.historial,
  creadaPor: o.creadaPor ? nombreDe(o.creadaPor) : undefined,
  creadoEn: o.creadoEn,
  actualizadoEn: o.actualizadoEn,
});

export async function listarOrdenes(
  actor: Actor,
  filtro: { estado?: Estado; buscar?: string; abiertas?: boolean } = {},
  limite = 100,
) {
  const consulta = (await bd())
    .getRepository(Orden)
    .createQueryBuilder('o')
    .leftJoinAndSelect('o.vehiculo', 'v')
    .leftJoinAndSelect('v.cliente', 'c')
    .leftJoinAndSelect('o.asignaciones', 'a')
    .leftJoinAndSelect('a.mecanico', 'm')
    .orderBy('o.id', 'DESC')
    .take(limite);
  if (actor.rol === 'mecanico') {
    consulta.andWhere(
      'o.id IN (SELECT orden_id FROM asignaciones WHERE mecanico_id = :yo AND activa)',
      { yo: actor.id },
    );
  } else if (actor.rol === 'concesionario') {
    consulta.andWhere("o.origen = 'concesionario'");
  }
  if (filtro.estado) consulta.andWhere('o.estado = :estado', { estado: filtro.estado });
  if (filtro.abiertas) consulta.andWhere('o.estado IN (:...abiertos)', { abiertos: ABIERTOS });
  if (filtro.buscar) {
    const numero = numeroOrden(filtro.buscar);
    consulta.andWhere(
      "(v.placa ILIKE :t OR (c.nombre || ' ' || c.apellido) ILIKE :t" + (numero ? ' OR o.id = :n' : '') + ')',
      { t: `%${filtro.buscar}%`, n: numero },
    );
  }
  return (await consulta.getMany()).map(aOrden);
}

// El detalle: la orden con el resumen del diagnóstico y de la reparación.
export async function unaOrden(actor: Actor, codigo: string) {
  const db = await bd();
  const orden = await cargarOrden(db.manager, actor, codigo);
  const diagnostico = await db.getRepository(Diagnostico).findOne({
    where: { orden: { id: orden.id } },
    relations: { tareas: { repuestos: { item: true } }, mecanico: true },
  });
  const reparacion = await db.getRepository(Reparacion).findOne({ where: { orden: { id: orden.id } } });
  return {
    ...aOrden(orden),
    diagnostico: diagnostico && {
      estado: diagnostico.estado,
      mecanico: nombreDe(diagnostico.mecanico),
      tareas: diagnostico.tareas.length,
      costo: costoEstimado(diagnostico.tareas, diagnostico.tarifaHora),
    },
    reparacion: reparacion && {
      estado: reparacion.estado,
      iniciadaEn: reparacion.iniciadaEn,
      terminadaEn: reparacion.terminadaEn,
      total: reparacion.total,
    },
  };
}

export async function crearOrden(
  actor: Actor,
  datos: NuevaOrden,
  { origen = 'taller', tx }: { origen?: Origen; tx?: EntityManager } = {},
) {
  const trabajo = async (gestor: EntityManager) => {
    const vehiculo = await gestor.findOne(Vehiculo, {
      where: { placa: datos.placa },
      relations: { cliente: true },
    });
    if (!vehiculo) throw noEncontrado(`No existe un vehículo con la placa ${datos.placa}. Regístrelo primero`);
    const abierta = await gestor.findOne(Orden, {
      where: { vehiculo: { id: vehiculo.id }, estado: In([...ABIERTOS]) },
    });
    if (abierta) {
      throw conflicto(`El vehículo ${vehiculo.placa} ya tiene la orden ${codigoOrden(abierta.id)} abierta`);
    }
    if (datos.kilometraje !== undefined && datos.kilometraje > vehiculo.kilometraje) {
      await gestor.update(Vehiculo, vehiculo.id, { kilometraje: datos.kilometraje });
    }
    const orden = await gestor.save(
      gestor.create(Orden, {
        vehiculo,
        motivo: datos.motivo,
        kilometraje: datos.kilometraje ?? null,
        origen,
        creadaPor: { id: actor.id },
        historial: [paso('recibido', nombreDe(actor))],
      }),
    );
    if (origen === 'concesionario') {
      await encolar(gestor, 'concesionario', 'notificar_estado_vehiculo', {
        referencia_externa: vehiculo.referenciaExterna,
        placa: vehiculo.placa,
        orden: codigoOrden(orden.id),
        estado: 'recibido',
        fecha: new Date().toISOString(),
      });
    }
    return codigoOrden(orden.id);
  };
  // Si viene de otra transacción (el ingreso del concesionario), se une a ella.
  if (tx) return trabajo(tx);
  const codigo = await (await bd()).transaction(trabajo);
  avisarDespacho();
  return unaOrden(actor, codigo);
}

export async function asignar(actor: Actor, codigo: string, mecanicoId: string, etapa: Etapa) {
  await (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    const mecanico = await tx.findOneBy(Usuario, { id: mecanicoId });
    if (!mecanico || !mecanico.activo || mecanico.rol.nombre !== 'mecanico') {
      throw invalido('Ese usuario no es un mecánico activo');
    }
    const nuevoEstado = estadoTrasAsignar(orden.estado, etapa, codigo);
    if (orden.asignaciones.some((a) => a.activa && a.etapa === etapa && a.mecanico.id === mecanicoId)) {
      throw conflicto(`${nombreDe(mecanico)} ya está asignado a la etapa de ${etapa}`);
    }
    await tx.save(tx.create(Asignacion, { orden, mecanico, etapa, asignadoPor: { id: actor.id } }));
    // El primer mecánico de diagnóstico abre el diagnóstico; el primero de reparación
    // abre la reparación.
    if (etapa === 'diagnostico' && !(await tx.existsBy(Diagnostico, { orden: { id: orden.id } }))) {
      await tx.save(tx.create(Diagnostico, { orden, mecanico, tarifaHora: TARIFA_HORA, observaciones: '' }));
    }
    if (etapa === 'reparacion' && !(await tx.existsBy(Reparacion, { orden: { id: orden.id } }))) {
      await tx.save(tx.create(Reparacion, { orden }));
    }
    if (nuevoEstado !== orden.estado) {
      await transicionar(tx, orden, nuevoEstado, actor, `Asignado ${nombreDe(mecanico)}`);
    }
  });
  avisarDespacho();
  return unaOrden(actor, codigo);
}

export async function desasignar(actor: Actor, codigo: string, asignacionId: number) {
  const db = await bd();
  const orden = await cargarOrden(db.manager, actor, codigo);
  const asignacion = orden.asignaciones.find((a) => a.id === asignacionId && a.activa);
  if (!asignacion) throw noEncontrado('Esa asignación no existe en la orden');
  await db.getRepository(Asignacion).update(asignacionId, { activa: false });
  return unaOrden(actor, codigo);
}

// Aprobar (el cliente aceptó el costo) o entregar el carro.
export async function cambiarEstado(actor: Actor, codigo: string, estado: 'aprobado' | 'entregado', nota?: string) {
  await (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    await transicionar(tx, orden, estado, actor, nota);
  });
  avisarDespacho();
  return unaOrden(actor, codigo);
}

// Cancela la orden en la etapa en que esté: el diagnóstico en borrador y la
// reparación en curso quedan cancelados. Las partes ya usadas siguen registradas.
export async function cancelar(actor: Actor, codigo: string, motivo: string) {
  await (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    await transicionar(tx, orden, 'cancelado', actor, motivo);
    await tx.update(Orden, orden.id, { motivoCancelacion: motivo });
    await tx.update(Diagnostico, { orden: { id: orden.id }, estado: 'borrador' }, { estado: 'cancelado' });
    await tx.update(Reparacion, { orden: { id: orden.id }, estado: 'en_curso' }, { estado: 'cancelada' });
  });
  avisarDespacho();
  return unaOrden(actor, codigo);
}

export async function disponibilidad() {
  const db = await bd();
  const mecanicos = await db.getRepository(Usuario).find({
    where: { rol: { nombre: 'mecanico' }, activo: true },
  });
  const filas: { mecanico_id: string; orden_id: number; estado: Estado; etapa: Etapa }[] = await db.query(
    `SELECT a.mecanico_id, a.orden_id, o.estado, a.etapa
       FROM asignaciones a JOIN ordenes o ON o.id = a.orden_id
      WHERE a.activa AND o.estado = ANY($1)`,
    [[...ABIERTOS]],
  );
  return cargaPorMecanico(
    mecanicos,
    filas.map<FilaCarga>((f) => ({ mecanicoId: f.mecanico_id, ordenId: f.orden_id, estado: f.estado, etapa: f.etapa })),
  );
}

export async function panel() {
  const db = await bd();
  const [porEstado, [alertas], [facturado], ultimas] = await Promise.all([
    db.query('SELECT estado, count(*)::int AS total FROM ordenes GROUP BY estado') as Promise<
      { estado: Estado; total: number }[]
    >,
    db.query('SELECT count(*)::int AS total FROM items WHERE activo AND cantidad <= nivel_alerta'),
    db.query(
      `SELECT coalesce(sum(total), 0)::float AS total, count(*)::int AS ordenes
         FROM reparaciones
        WHERE estado = 'terminada' AND terminada_en >= date_trunc('month', now())`,
    ),
    listarOrdenes({ id: '', nombre: '', apellido: '', usuario: '', rol: 'administrador' }, { abiertas: true }, 6),
  ]);
  const cuenta = (estados: readonly Estado[]) =>
    porEstado.filter((f) => estados.includes(f.estado)).reduce((s, f) => s + f.total, 0);
  return {
    abiertas: cuenta(ABIERTOS),
    enDiagnostico: cuenta(['en_diagnostico']),
    porAprobar: cuenta(['diagnosticado']),
    enReparacion: cuenta(['en_reparacion']),
    listasParaEntregar: cuenta(['terminado']),
    itemsEnAlerta: alertas.total as number,
    facturadoMes: facturado.total as number,
    ordenesFacturadasMes: facturado.ordenes as number,
    porEstado,
    ultimas,
    mecanicos: await disponibilidad(),
  };
}
