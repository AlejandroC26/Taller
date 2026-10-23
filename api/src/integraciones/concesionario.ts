import { z } from 'zod';
import { bd } from '../base-datos/conexion';
import { Cliente } from '../clientes/cliente.entity';
import { aCliente, aVehiculo, crearCliente, crearVehiculo } from '../clientes/clientes.service';
import { clienteDto, vehiculoDto } from '../clientes/dto';
import { Vehiculo } from '../clientes/vehiculo.entity';
import { noEncontrado } from '../comun/errores';
import { Orden } from '../ordenes/orden.entity';
import { crearOrden, unaOrden } from '../ordenes/ordenes.service';
import { codigoOrden } from '../ordenes/reglas';
import { avisarDespacho } from './bandeja';
import type { Actor } from '../usuarios/actor';

// Lo que envía el sistema del concesionario cuando manda un carro al taller.
export const ingresoDto = z.object({
  referencia_externa: z.string().trim().min(1, 'Falta la referencia del concesionario').max(80),
  cliente: clienteDto,
  vehiculo: vehiculoDto,
  motivo: z.string().trim().min(3, 'Describa el motivo de ingreso').max(2000),
  kilometraje: z.number().int().min(0).optional(),
});
export type Ingreso = z.infer<typeof ingresoDto>;

// Registra (o reutiliza) cliente y vehículo y abre la orden, todo en una transacción.
export async function registrarIngreso(actor: Actor, datos: Ingreso) {
  const codigo = await (await bd()).transaction(async (tx) => {
    const cliente =
      (await tx.findOneBy(Cliente, { documento: datos.cliente.documento })) ??
      (await crearCliente(datos.cliente, tx));
    const existente =
      (await tx.findOneBy(Vehiculo, { referenciaExterna: datos.referencia_externa })) ??
      (await tx.findOneBy(Vehiculo, { placa: datos.vehiculo.placa }));
    if (!existente) {
      await crearVehiculo(cliente.id, datos.vehiculo, { origen: 'concesionario', referenciaExterna: datos.referencia_externa }, tx);
    } else if (!existente.referenciaExterna) {
      await tx.update(Vehiculo, existente.id, { origen: 'concesionario', referenciaExterna: datos.referencia_externa });
    }
    return crearOrden(
      actor,
      { placa: existente?.placa ?? datos.vehiculo.placa, motivo: datos.motivo, kilometraje: datos.kilometraje },
      { origen: 'concesionario', tx },
    );
  });
  avisarDespacho();
  return unaOrden(actor, codigo as string);
}

// En qué va un carro enviado por el concesionario.
export async function estadoVehiculo(referencia: string) {
  const db = await bd();
  const vehiculo = await db.getRepository(Vehiculo).findOne({
    where: { referenciaExterna: referencia },
    relations: { cliente: true },
  });
  if (!vehiculo) throw noEncontrado(`No hay un vehículo con la referencia ${referencia}`);
  const ordenes = await db.getRepository(Orden).find({
    where: { vehiculo: { id: vehiculo.id } },
    order: { id: 'DESC' },
    take: 5,
  });
  return {
    vehiculo: aVehiculo(vehiculo),
    cliente: aCliente(vehiculo.cliente),
    ordenes: ordenes.map((o) => ({
      codigo: codigoOrden(o.id),
      estado: o.estado,
      motivo: o.motivo,
      historial: o.historial,
      actualizadoEn: o.actualizadoEn,
    })),
  };
}
