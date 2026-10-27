import { coberturaDe, decidirComoConcesionario } from '../../../garantias/reglas';
import type { ProveedorConcesionario } from '../proveedor';
import { cabeceraSimulada, RELACIONES } from './datos';

// El concesionario simulado: responde con el arreglo de datos.ts y decide la garantía
// al instante con la regla de garantias/reglas.ts.
export function concesionarioSimulado(hoy = () => new Date()): ProveedorConcesionario {
  const buscar = (idRelacion: string) => RELACIONES.find((r) => r.idRelacion === idRelacion.trim().toUpperCase());
  return {
    modo: 'simulado',
    async consultarRelacion(idRelacion) {
      const r = buscar(idRelacion);
      if (!r) return null;
      const cabecera = cabeceraSimulada(r.vin);
      if (!cabecera) return null;
      return {
        idRelacion: r.idRelacion,
        cedula: r.cedula,
        cliente: r.cliente,
        telefono: r.telefono,
        vin: r.vin,
        placa: r.placa,
        kilometraje: r.kilometraje,
        cabeceraVin: cabecera,
        garantia: coberturaDe(r.fechaVenta, r.kilometraje, r.cubre, hoy()),
      };
    },
    async decodificarVin(vin) {
      return cabeceraSimulada(vin);
    },
    async validarGarantia(solicitud) {
      const r = buscar(solicitud.idRelacion);
      const cobertura = r
        ? coberturaDe(r.fechaVenta, r.kilometraje, r.cubre, hoy())
        : { vigente: false, vence: '', kmMaximo: 0, cubre: [], motivo: 'El concesionario no reconoce el vehículo' };
      return solicitud.servicios.map((s) => decidirComoConcesionario(cobertura, s));
    },
  };
}
