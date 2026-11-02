import type { ProveedorTiendas } from '../proveedor';
import { REPUESTOS_SIMULADOS, TIENDA_SIMULADA } from './datos';

export function tiendaSimulada(): ProveedorTiendas {
  return {
    modo: 'simulado',
    nombres: [TIENDA_SIMULADA],
    async catalogo() {
      return { repuestos: REPUESTOS_SIMULADOS, sin_respuesta: [], actualizado_en: new Date().toISOString() };
    },
  };
}
