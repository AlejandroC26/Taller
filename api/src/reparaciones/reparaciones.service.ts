import type { EntityManager } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { pesos } from '../comun/columnas';
import { invalido, noEncontrado } from '../comun/errores';
import { buscarDiagnostico } from '../diagnosticos/diagnosticos.service';
import { costoEstimado } from '../diagnosticos/reglas';
import { Tarea } from '../diagnosticos/tarea.entity';
import { avisarDespacho, encolar } from '../integraciones/bandeja';
import { moverExistencias } from '../inventario/inventario.service';
import { asignadoA, cargarOrden, nombreDe, transicionar } from '../ordenes/ordenes.service';
import type { Orden } from '../ordenes/orden.entity';
import { codigoOrden, exigirTrabajo } from '../ordenes/reglas';
import type { Actor } from '../usuarios/actor';
import type { DatosHoras } from './dto';
import { ParteUsada } from './parte-usada.entity';
import { RegistroHoras } from './registro-horas.entity';
import { Reparacion } from './reparacion.entity';
import { horasEntre, lineasFactura, liquidar } from './reglas';

async function buscarReparacion(gestor: EntityManager, ordenId: number) {
  const reparacion = await gestor.findOne(Reparacion, {
    where: { orden: { id: ordenId } },
    relations: { horas: { tarea: true, mecanico: true }, partes: { item: true } },
  });
  if (!reparacion) throw noEncontrado('La orden todavía no tiene reparación: asigne un mecánico de reparación');
  return reparacion;
}

// Abre una transacción, carga la orden y comprueba que se pueda registrar trabajo de
// reparación en ella.
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
  const diagnostico = await buscarDiagnostico(orden.id);
  const tareas = [...diagnostico.tareas].sort((a, b) => a.posicion - b.posicion);
  const partes = reparacion.partes.map((p) => ({
    id: p.id,
    itemId: p.item.id,
    codigo: p.item.codigo,
    descripcion: p.item.nombre,
    cantidad: p.cantidad,
    precioUnitario: p.precioUnitario,
    subtotal: pesos(p.cantidad * p.precioUnitario),
  }));
  const estimado = costoEstimado(tareas, diagnostico.tarifaHora);
  const real = liquidar({ tarifaHora: diagnostico.tarifaHora, tareas, horas: reparacion.horas, partes });
  return {
    orden: codigoOrden(orden.id),
    estadoOrden: orden.estado,
    estado: reparacion.estado,
    iniciadaEn: reparacion.iniciadaEn,
    terminadaEn: reparacion.terminadaEn,
    tarifaHora: diagnostico.tarifaHora,
    tareas: tareas.map((t) => ({
      id: t.id,
      posicion: t.posicion,
      descripcion: t.descripcion,
      horasEstimadas: t.horasEstimadas,
      valorServicio: t.valorServicio,
      completada: t.completada,
    })),
    horas: reparacion.horas
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
      .map((h) => ({
        id: h.id,
        mecanico: nombreDe(h.mecanico),
        mecanicoId: h.mecanico.id,
        tareaId: h.tarea?.id ?? null,
        inicio: h.inicio,
        fin: h.fin,
        horas: h.horas,
        nota: h.nota,
      })),
    partes,
    estimado,
    real,
    diferencia: pesos(real.total - estimado.total),
  };
}

export const liquidacion = verReparacion;

export async function registrarHoras(actor: Actor, codigo: string, datos: DatosHoras) {
  await enReparacion(actor, codigo, async (tx, orden, reparacion) => {
    // El mecánico registra su tiempo; el administrador puede registrar el de otro
    // mecánico asignado.
    let mecanicoId = actor.id;
    if (datos.mecanicoId && datos.mecanicoId !== actor.id) {
      if (actor.rol !== 'administrador') throw invalido('Solo puede registrar sus propias horas');
      const asignado = orden.asignaciones.some(
        (a) => a.activa && a.etapa === 'reparacion' && a.mecanico.id === datos.mecanicoId,
      );
      if (!asignado) throw invalido('Ese mecánico no está asignado a la reparación');
      mecanicoId = datos.mecanicoId;
    }
    const inicio = new Date(datos.inicio);
    const fin = new Date(datos.fin);
    const horas = horasEntre(inicio, fin);
    let tarea: Tarea | null = null;
    if (datos.tareaId) {
      tarea = await tx.findOne(Tarea, {
        where: { id: datos.tareaId, diagnostico: { orden: { id: orden.id } } },
      });
      if (!tarea) throw invalido('Ese paso no pertenece al diagnóstico de la orden');
    }
    await tx.save(
      tx.create(RegistroHoras, { reparacion, mecanico: { id: mecanicoId }, tarea, inicio, fin, horas, nota: datos.nota }),
    );
  });
  return verReparacion(actor, codigo);
}

// La parte sale del inventario en la misma transacción: si no hay existencias, no se
// registra nada.
export async function registrarParte(actor: Actor, codigo: string, itemId: number, cantidad: number) {
  await enReparacion(actor, codigo, async (tx, orden, reparacion) => {
    const { precio } = await moverExistencias(tx, itemId, 'salida', cantidad, actor, {
      ordenId: orden.id,
      nota: `Usado en la orden ${codigoOrden(orden.id)}`,
    });
    await tx.save(
      tx.create(ParteUsada, {
        reparacion,
        item: { id: itemId },
        cantidad,
        precioUnitario: precio,
        registradaPor: { id: actor.id },
      }),
    );
  });
  return verReparacion(actor, codigo);
}

export async function marcarTarea(actor: Actor, codigo: string, tareaId: number, completada: boolean) {
  await enReparacion(actor, codigo, async (tx, orden) => {
    const tarea = await tx.findOne(Tarea, { where: { id: tareaId, diagnostico: { orden: { id: orden.id } } } });
    if (!tarea) throw noEncontrado('Ese paso no pertenece al diagnóstico de la orden');
    await tx.update(Tarea, tareaId, { completada });
  });
  return verReparacion(actor, codigo);
}

// Cierra la reparación con su total y le pide la factura al proyecto de facturación.
export async function terminarReparacion(actor: Actor, codigo: string) {
  await enReparacion(actor, codigo, async (tx, orden, reparacion) => {
    if (reparacion.horas.length === 0) throw invalido('Registre las horas trabajadas antes de terminar');
    const diagnostico = await buscarDiagnostico(orden.id, tx);
    const partes = reparacion.partes.map((p) => ({
      descripcion: p.item.nombre,
      cantidad: p.cantidad,
      precioUnitario: p.precioUnitario,
    }));
    const datos = { tarifaHora: diagnostico.tarifaHora, tareas: diagnostico.tareas, horas: reparacion.horas, partes };
    const real = liquidar(datos);
    await tx.update(Reparacion, reparacion.id, { estado: 'terminada', terminadaEn: new Date(), total: real.total });
    await transicionar(tx, orden, 'terminado', actor, `Total ${real.total}`);
    const cliente = orden.vehiculo.cliente;
    await encolar(tx, 'facturacion', 'emitir_factura', {
      orden: codigoOrden(orden.id),
      cliente: { documento: cliente.documento, nombre: nombreDe(cliente), correo: cliente.correo, telefono: cliente.telefono },
      vehiculo: { placa: orden.vehiculo.placa, marca: orden.vehiculo.marca, modelo: orden.vehiculo.modelo },
      origen: orden.origen,
      lineas: lineasFactura(datos),
      total: real.total,
    });
  });
  return verReparacion(actor, codigo);
}
