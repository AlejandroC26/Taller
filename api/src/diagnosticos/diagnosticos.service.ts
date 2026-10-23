import { In } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { invalido, noEncontrado, prohibido } from '../comun/errores';
import { avisarDespacho, encolar } from '../integraciones/bandeja';
import { Item } from '../inventario/item.entity';
import { asignadoA, cargarOrden, nombreDe, transicionar } from '../ordenes/ordenes.service';
import { codigoOrden, exigirTrabajo } from '../ordenes/reglas';
import type { Actor } from '../usuarios/actor';
import { tiene } from '../usuarios/actor';
import { PERSONAL } from '../usuarios/rol.entity';
import { Diagnostico } from './diagnostico.entity';
import type { DatosDiagnostico } from './dto';
import { Repuesto } from './repuesto.entity';
import { costoEstimado } from './reglas';
import { Tarea } from './tarea.entity';

export const aDiagnostico = (d: Diagnostico) => {
  const tareas = [...d.tareas].sort((a, b) => a.posicion - b.posicion);
  return {
    estado: d.estado,
    mecanico: nombreDe(d.mecanico),
    observaciones: d.observaciones,
    tarifaHora: d.tarifaHora,
    finalizadoEn: d.finalizadoEn,
    tareas: tareas.map((t) => ({
      id: t.id,
      posicion: t.posicion,
      descripcion: t.descripcion,
      horasEstimadas: t.horasEstimadas,
      valorServicio: t.valorServicio,
      requierePiezas: t.requierePiezas,
      completada: t.completada,
      repuestos: t.repuestos.map((r) => ({
        id: r.id,
        itemId: r.item?.id ?? null,
        codigo: r.item?.codigo ?? null,
        descripcion: r.descripcion,
        cantidad: r.cantidad,
        precioUnitario: r.precioUnitario,
        // Sin ítem o sin existencias suficientes: hay que pedirla.
        disponible: r.item ? r.item.cantidad >= r.cantidad : false,
      })),
    })),
    costo: costoEstimado(tareas, d.tarifaHora),
  };
};

export async function buscarDiagnostico(ordenId: number, gestor?: EntityManager) {
  const diagnostico = await (gestor ?? (await bd()).manager).findOne(Diagnostico, {
    where: { orden: { id: ordenId } },
    relations: { tareas: { repuestos: { item: true } }, mecanico: true },
  });
  if (!diagnostico) throw noEncontrado('La orden todavía no tiene diagnóstico: asigne un mecánico');
  return diagnostico;
}

export async function verDiagnostico(actor: Actor, codigo: string) {
  const db = await bd();
  const orden = await cargarOrden(db.manager, actor, codigo);
  return { orden: codigoOrden(orden.id), estadoOrden: orden.estado, ...aDiagnostico(await buscarDiagnostico(orden.id)) };
}

// Guarda el borrador: reemplaza el paso a paso completo.
export async function guardarDiagnostico(actor: Actor, codigo: string, datos: DatosDiagnostico) {
  await (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    exigirTrabajo(actor.rol, asignadoA(orden, actor, 'diagnostico'), 'diagnostico');
    if (orden.estado !== 'en_diagnostico') {
      throw invalido(`La orden ${codigo} está ${orden.estado}: el diagnóstico ya no se puede cambiar`);
    }
    const diagnostico = await buscarDiagnostico(orden.id, tx);
    if (diagnostico.estado !== 'borrador') throw invalido('El diagnóstico ya fue finalizado');
    if (datos.tarifaHora !== undefined && datos.tarifaHora !== diagnostico.tarifaHora && !tiene(actor, PERSONAL)) {
      throw prohibido('Solo el personal del taller cambia la tarifa por hora');
    }

    const ids = datos.tareas.flatMap((t) => t.repuestos.map((r) => r.itemId).filter((id): id is number => !!id));
    const items = ids.length ? await tx.findBy(Item, { id: In(ids), activo: true }) : [];
    const itemDe = (id: number) => {
      const item = items.find((i) => i.id === id);
      if (!item) throw invalido(`El ítem ${id} no existe en el inventario`);
      return item;
    };

    await tx.delete(Tarea, { diagnostico: { id: diagnostico.id } });
    await tx.update(Diagnostico, diagnostico.id, {
      observaciones: datos.observaciones,
      ...(datos.tarifaHora !== undefined ? { tarifaHora: datos.tarifaHora } : {}),
      // Quien guarda el diagnóstico queda como responsable.
      ...(actor.rol === 'mecanico' ? { mecanico: { id: actor.id } } : {}),
    });
    for (const [i, t] of datos.tareas.entries()) {
      const tarea = await tx.save(
        tx.create(Tarea, {
          diagnostico: { id: diagnostico.id },
          posicion: i + 1,
          descripcion: t.descripcion,
          horasEstimadas: t.horasEstimadas,
          valorServicio: t.valorServicio,
          requierePiezas: t.requierePiezas || t.repuestos.length > 0,
        }),
      );
      for (const r of t.repuestos) {
        const item = r.itemId ? itemDe(r.itemId) : null;
        await tx.save(
          tx.create(Repuesto, {
            tarea,
            item,
            descripcion: item?.nombre ?? r.descripcion ?? '',
            cantidad: r.cantidad,
            precioUnitario: item?.precio ?? r.precioUnitario ?? 0,
          }),
        );
      }
    }
  });
  return verDiagnostico(actor, codigo);
}

// Cierra el diagnóstico: la orden queda lista para que el cliente apruebe el costo. Las
// piezas que faltan se le piden al proyecto de partes.
export async function finalizarDiagnostico(actor: Actor, codigo: string) {
  await (await bd()).transaction(async (tx) => {
    const orden = await cargarOrden(tx, actor, codigo, true);
    exigirTrabajo(actor.rol, asignadoA(orden, actor, 'diagnostico'), 'diagnostico');
    const diagnostico = await buscarDiagnostico(orden.id, tx);
    if (diagnostico.estado !== 'borrador') throw invalido('El diagnóstico ya fue finalizado');
    if (diagnostico.tareas.length === 0) throw invalido('El diagnóstico necesita al menos un paso');
    await tx.update(Diagnostico, diagnostico.id, { estado: 'finalizado', finalizadoEn: new Date() });
    const costo = costoEstimado(diagnostico.tareas, diagnostico.tarifaHora);
    await transicionar(tx, orden, 'diagnosticado', actor, `Costo estimado ${costo.total}`);

    const faltantes = aDiagnostico(diagnostico).tareas.flatMap((t) => t.repuestos.filter((r) => !r.disponible));
    for (const r of faltantes) {
      await encolar(tx, 'partes', 'solicitar_parte', {
        orden: codigoOrden(orden.id),
        placa: orden.vehiculo.placa,
        vehiculo: `${orden.vehiculo.marca} ${orden.vehiculo.modelo} ${orden.vehiculo.anio}`,
        codigo: r.codigo,
        descripcion: r.descripcion,
        cantidad: r.cantidad,
      });
    }
  });
  avisarDespacho();
  return verDiagnostico(actor, codigo);
}
