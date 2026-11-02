import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import { bd } from '../base-datos/conexion';
import { NOMBRE_TALLER } from '../config';
import { invalido } from '../comun/errores';
import { Tarea } from '../diagnosticos/tarea.entity';
import { PAGADORES } from '../garantias/reglas';
import { avisarDespacho, encolar } from '../integraciones/bandeja';
import { unaVez } from '../integraciones/idempotencia';
import { Asignacion } from '../ordenes/asignacion.entity';
import { Orden } from '../ordenes/orden.entity';
import { cargarOrden, siguientePaso, transicionar, unaOrden } from '../ordenes/ordenes.service';
import { codigoOrden } from '../ordenes/reglas';
import { descripcionVehiculo } from '../relaciones/relaciones.service';
import type { Actor } from '../usuarios/actor';
import { CompraRepuesto } from './compra.entity';
import { armarCotizacion } from './reglas';
import type { Cotizacion } from './reglas';

export const respuestaClienteDto = z.object({
  aceptada: z.boolean(),
  motivo: z.string().trim().max(1000).optional(),
  referencia: z.string().trim().max(80).optional(),
  // La orden de compra que armó facturación con las tiendas (si el cliente aceptó).
  ordenCompra: z
    .array(
      z.object({
        // El código universal, el mismo de la cotización.
        codigoRepuesto: z.string().trim().toUpperCase().min(1).max(50),
        descripcion: z.string().trim().max(200).optional(),
        cantidad: z.number().int().min(1),
        tienda: z.string().trim().min(2).max(120),
        precioUnitario: z.number().min(0),
        pagador: z.enum(PAGADORES).optional(),
      }),
    )
    .default([]),
});

export const pagoDto = z.object({
  referenciaPse: z.string().trim().min(3).max(80),
  valor: z.number().min(0),
});

export async function construirCotizacion(gestor: EntityManager, orden: Orden): Promise<Cotizacion> {
  const tareas = await gestor.find(Tarea, {
    where: { diagnostico: { orden: { id: orden.id } } },
    relations: { repuestos: true },
    order: { posicion: 'ASC' },
  });
  return armarCotizacion(
    {
      codigo: codigoOrden(orden.id),
      id_relacion: orden.relacion.idRelacion,
      taller: NOMBRE_TALLER,
      sede: orden.taller.nombre,
      cliente: { cedula: orden.relacion.cedula, nombre: orden.relacion.cliente, telefono: orden.relacion.telefono },
      vehiculo: {
        vin: orden.relacion.vin,
        placa: orden.relacion.placa,
        marca: orden.relacion.cabeceraVin.marca,
        modelo: orden.relacion.cabeceraVin.modelo,
        anio: orden.relacion.cabeceraVin.anio,
        descripcion: descripcionVehiculo(orden.relacion),
      },
    },
    tareas,
  );
}

// Se envía a facturación: mano de obra con precio y, si hacen falta, los repuestos por código.
export async function enviarCotizacion(tx: EntityManager, orden: Orden) {
  const cotizacion = await construirCotizacion(tx, orden);
  await tx.update(Orden, orden.id, { cotizacionRef: `COT-${cotizacion.codigo}` });
  await encolar(tx, 'facturacion', 'crear_cotizacion', { ...cotizacion, responder_con: 'registrar_respuesta_cliente' });
}

export async function consultarCotizacion(actor: Actor, codigo: string) {
  const db = await bd();
  const orden = await cargarOrden(db.manager, actor, codigo);
  const enCotizacionODespues = ['en_cotizacion', 'aprobada', 'rechazada', 'en_reparacion', 'pendiente_facturacion', 'facturada', 'entregada'];
  if (!enCotizacionODespues.includes(orden.estado)) {
    throw invalido(`La orden ${codigo} está ${orden.estado}: todavía no tiene cotización`);
  }
  const compras = await db.getRepository(CompraRepuesto).find({ where: { orden: { id: orden.id } }, order: { id: 'ASC' } });
  return {
    estado: orden.estado,
    ...siguientePaso(orden.estado),
    cotizacion_ref: orden.cotizacionRef,
    ...(await construirCotizacion(db.manager, orden)),
    orden_compra: compras.map((c) => ({
      id: c.id,
      codigo_repuesto: c.codigoRepuesto,
      descripcion: c.descripcion,
      cantidad: c.cantidad,
      tienda: c.tienda,
      precio_unitario: c.precioUnitario,
      pagador: c.pagador,
    })),
  };
}

// Facturación le preguntó al cliente por Telegram y responde aquí.
export async function registrarRespuestaCliente(
  actor: Actor,
  codigo: string,
  datos: z.infer<typeof respuestaClienteDto>,
  idMensaje?: string,
) {
  return unaVez(idMensaje, 'registrar_respuesta_cliente', async () => {
    await (await bd()).transaction(async (tx) => {
      const orden = await cargarOrden(tx, actor, codigo, true);
      if (orden.estado !== 'en_cotizacion') throw invalido(`La orden ${codigo} está ${orden.estado}: no espera respuesta del cliente`);
      if (datos.aceptada) {
        const cotizacion = await construirCotizacion(tx, orden);
        for (const c of datos.ordenCompra) {
          const linea = cotizacion.repuestos.find((r) => r.codigo_repuesto === c.codigoRepuesto);
          await tx.save(
            tx.create(CompraRepuesto, {
              orden: { id: orden.id },
              codigoRepuesto: c.codigoRepuesto,
              descripcion: c.descripcion ?? linea?.descripcion ?? '',
              cantidad: c.cantidad,
              tienda: c.tienda,
              precioUnitario: c.precioUnitario,
              pagador: c.pagador ?? linea?.garantia.pagador ?? 'cliente',
            }),
          );
        }
        if (datos.referencia) await tx.update(Orden, orden.id, { cotizacionRef: datos.referencia });
        await transicionar(tx, orden, 'aprobada', actor, 'El cliente aceptó la cotización');
      } else {
        await transicionar(tx, orden, 'rechazada', actor, datos.motivo ?? 'El cliente rechazó la cotización');
        await tx.update(Asignacion, { orden: { id: orden.id }, activa: true }, { activa: false });
      }
    });
    avisarDespacho();
    return unaOrden(actor, codigo);
  });
}

// Facturación confirma el pago del PSE: el vehículo puede salir.
export async function registrarPago(actor: Actor, codigo: string, datos: z.infer<typeof pagoDto>, idMensaje?: string) {
  return unaVez(idMensaje, 'registrar_pago', async () => {
    await (await bd()).transaction(async (tx) => {
      const orden = await cargarOrden(tx, actor, codigo, true);
      if (orden.estado !== 'pendiente_facturacion') {
        throw invalido(`La orden ${codigo} está ${orden.estado}: no espera pago`);
      }
      await tx.update(Orden, orden.id, { pagoRef: datos.referenciaPse });
      await transicionar(tx, orden, 'facturada', actor, `Pago PSE ${datos.referenciaPse} por ${datos.valor}`);
    });
    avisarDespacho();
    return unaOrden(actor, codigo);
  });
}
