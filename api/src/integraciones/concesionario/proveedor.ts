import type { ResultadoGarantia, ServicioAValidar } from '../../garantias/reglas';
import type { Especialidad } from '../../talleres/reglas';

// Lo que el taller necesita del concesionario. Hay dos implementaciones: la simulada (un
// arreglo, mientras el concesionario no exista) y la de su MCP.

// Cabecera del VIN: lo que la API pública del concesionario sabe del carro por su VIN.
export interface CabeceraVin {
  vin: string;
  marca: string;
  modelo: string;
  anio: number;
  version: string;
  carroceria: string;
  puertas: number;
  motor: string;
  combustible: string;
  transmision: string;
}

export interface Cobertura {
  vigente: boolean;
  vence: string;
  kmMaximo: number;
  cubre: Especialidad[];
  motivo?: string;
}

export interface DatosRelacion {
  idRelacion: string;
  cedula: string;
  cliente: string;
  telefono: string;
  vin: string;
  placa: string;
  kilometraje: number;
  cabeceraVin: CabeceraVin;
  garantia: Cobertura;
}

export interface SolicitudGarantia {
  codigo: string;
  idRelacion: string;
  vin: string;
  porGarantia: boolean;
  motivoReclamo: string | null;
  servicios: ServicioAValidar[];
}

export interface ProveedorConcesionario {
  modo: 'simulado' | 'mcp';
  consultarRelacion(idRelacion: string): Promise<DatosRelacion | null>;
  decodificarVin(vin: string): Promise<CabeceraVin | null>;
  // Con resultados, la respuesta es inmediata. Con null, la respuesta llega después por
  // la herramienta registrar_resultado_garantia.
  validarGarantia(solicitud: SolicitudGarantia): Promise<ResultadoGarantia[] | null>;
}
