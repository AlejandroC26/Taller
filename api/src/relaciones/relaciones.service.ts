import type { EntityManager } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { noDisponible, noEncontrado } from '../comun/errores';
import { concesionario } from '../integraciones/concesionario';
import { RelacionVehiculo } from './relacion.entity';

// El taller no registra clientes: los conoce por el id_relacion del concesionario. Cada
// consulta refresca la copia local (cliente, vehículo por VIN y garantía vigente).
export async function obtenerRelacion(idRelacion: string, tx?: EntityManager): Promise<RelacionVehiculo> {
  const id = idRelacion.trim().toUpperCase();
  let datos;
  try {
    datos = await concesionario().consultarRelacion(id);
  } catch {
    throw noDisponible('No hay conexión con el concesionario para consultar el id_relacion');
  }
  if (!datos) {
    throw noEncontrado(
      `El concesionario no reconoce el id_relacion ${id}. El cliente debe obtenerlo en el concesionario con su cédula y el VIN`,
    );
  }
  const repo = (tx ?? (await bd()).manager).getRepository(RelacionVehiculo);
  return repo.save(repo.create({ ...datos, idRelacion: datos.idRelacion.toUpperCase() }));
}

export const aRelacion = (r: RelacionVehiculo) => ({
  id_relacion: r.idRelacion,
  cliente: { cedula: r.cedula, nombre: r.cliente, telefono: r.telefono },
  vehiculo: { ...r.cabeceraVin, placa: r.placa, kilometraje: r.kilometraje },
  garantia: r.garantia,
});

export const descripcionVehiculo = (r: RelacionVehiculo) =>
  `${r.cabeceraVin.marca} ${r.cabeceraVin.modelo} ${r.cabeceraVin.version} ${r.cabeceraVin.anio} (${r.cabeceraVin.carroceria}, ${r.cabeceraVin.puertas} puertas)`;
