import type { EntityManager } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { conflicto, noEncontrado } from '../comun/errores';
import { Cliente } from './cliente.entity';
import { normalizarPlaca } from './dto';
import type { DatosCliente, DatosVehiculo } from './dto';
import { Vehiculo } from './vehiculo.entity';
import type { Origen } from './vehiculo.entity';

export const aVehiculo = (v: Vehiculo) => ({
  id: v.id,
  placa: v.placa,
  marca: v.marca,
  modelo: v.modelo,
  anio: v.anio,
  color: v.color,
  kilometraje: v.kilometraje,
  origen: v.origen,
  referenciaExterna: v.referenciaExterna,
});

export const aCliente = (c: Cliente) => ({
  id: c.id,
  nombre: c.nombre,
  apellido: c.apellido,
  documento: c.documento,
  telefono: c.telefono,
  correo: c.correo,
  direccion: c.direccion,
  ...(c.vehiculos ? { vehiculos: c.vehiculos.map(aVehiculo) } : {}),
});

export async function listarClientes(buscar?: string) {
  const consulta = (await bd())
    .getRepository(Cliente)
    .createQueryBuilder('c')
    .leftJoinAndSelect('c.vehiculos', 'v')
    .orderBy('c.nombre', 'ASC')
    .take(100);
  if (buscar?.trim()) {
    consulta.where(
      "(c.nombre || ' ' || c.apellido) ILIKE :t OR c.documento ILIKE :t OR v.placa ILIKE :t",
      { t: `%${buscar.trim()}%` },
    );
  }
  return (await consulta.getMany()).map(aCliente);
}

export async function unCliente(id: number) {
  const cliente = await (await bd())
    .getRepository(Cliente)
    .findOne({ where: { id }, relations: { vehiculos: true } });
  if (!cliente) throw noEncontrado('No existe ese cliente');
  return aCliente(cliente);
}

export async function crearCliente(datos: DatosCliente, tx?: EntityManager) {
  const repo = (tx ?? (await bd()).manager).getRepository(Cliente);
  if (await repo.existsBy({ documento: datos.documento })) {
    throw conflicto(`Ya existe un cliente con el documento ${datos.documento}`);
  }
  return aCliente(await repo.save(repo.create({ ...datos, vehiculos: [] })));
}

export async function editarCliente(id: number, datos: Partial<DatosCliente>) {
  const repo = (await bd()).getRepository(Cliente);
  const cliente = await repo.findOneBy({ id });
  if (!cliente) throw noEncontrado('No existe ese cliente');
  if (datos.documento && datos.documento !== cliente.documento) {
    if (await repo.existsBy({ documento: datos.documento })) {
      throw conflicto(`Ya existe un cliente con el documento ${datos.documento}`);
    }
  }
  Object.assign(cliente, datos);
  await repo.save(cliente);
  return unCliente(id);
}

export async function crearVehiculo(
  clienteId: number,
  datos: DatosVehiculo,
  extra: { origen?: Origen; referenciaExterna?: string | null } = {},
  tx?: EntityManager,
) {
  const gestor = tx ?? (await bd()).manager;
  const cliente = await gestor.findOneBy(Cliente, { id: clienteId });
  if (!cliente) throw noEncontrado('No existe ese cliente');
  if (await gestor.existsBy(Vehiculo, { placa: datos.placa })) {
    throw conflicto(`Ya existe un vehículo con la placa ${datos.placa}`);
  }
  const vehiculo = await gestor.save(
    gestor.create(Vehiculo, { ...datos, ...extra, cliente }),
  );
  return aVehiculo(vehiculo);
}

export async function vehiculoPorPlaca(placa: string) {
  const vehiculo = await (await bd())
    .getRepository(Vehiculo)
    .findOne({ where: { placa: normalizarPlaca(placa) }, relations: { cliente: true } });
  if (!vehiculo) throw noEncontrado(`No existe un vehículo con la placa ${placa}`);
  return { ...aVehiculo(vehiculo), cliente: aCliente(vehiculo.cliente) };
}

export async function editarVehiculo(placa: string, datos: Partial<DatosVehiculo>) {
  const repo = (await bd()).getRepository(Vehiculo);
  const vehiculo = await repo.findOneBy({ placa: normalizarPlaca(placa) });
  if (!vehiculo) throw noEncontrado(`No existe un vehículo con la placa ${placa}`);
  Object.assign(vehiculo, datos);
  await repo.save(vehiculo);
  return vehiculoPorPlaca(vehiculo.placa);
}
