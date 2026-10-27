import { configuracion } from '../contrato';
import { llamarHerramienta } from '../conector-mcp';
import type { CabeceraVin, DatosRelacion, ProveedorConcesionario } from './proveedor';
import { concesionarioSimulado } from './simulado/simulado';

// El concesionario real, por su MCP. Las consultas son en línea; la validación de la
// garantía va por la bandeja de salida y su respuesta vuelve con
// registrar_resultado_garantia.
export function concesionarioMcp(): ProveedorConcesionario {
  return {
    modo: 'mcp',
    async consultarRelacion(idRelacion) {
      return (await llamarHerramienta('concesionario', 'consultar_relacion', { id_relacion: idRelacion })) as DatosRelacion | null;
    },
    async decodificarVin(vin) {
      return (await llamarHerramienta('concesionario', 'decodificar_vin', { vin })) as CabeceraVin | null;
    },
    async validarGarantia() {
      return null;
    },
  };
}

let reemplazo: ProveedorConcesionario | null = null;

// Simulado mientras no haya MCP_CONCESIONARIO_URL.
export function concesionario(): ProveedorConcesionario {
  if (reemplazo) return reemplazo;
  return configuracion('concesionario') ? concesionarioMcp() : concesionarioSimulado();
}

// Solo para pruebas.
export function usarConcesionario(proveedor: ProveedorConcesionario | null) {
  reemplazo = proveedor;
}
