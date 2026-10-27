import type { Especialidad } from '../../../talleres/reglas';
import type { CabeceraVin } from '../proveedor';

// Datos de PRUEBA del concesionario, mientras su sistema no exista. Cada id_relacion une
// a un cliente con un vehículo; el taller trabaja siempre con ese id.

export interface RelacionSimulada {
  idRelacion: string;
  cedula: string;
  cliente: string;
  telefono: string;
  vin: string;
  placa: string;
  kilometraje: number;
  fechaVenta: string;
  cubre: Especialidad[];
}

// Lo que cubre la garantía de fábrica de cada marca en estos datos.
const COMPLETA: Especialidad[] = ['frenos', 'suspension', 'motor', 'electrico', 'transmision'];
const TREN_MOTRIZ: Especialidad[] = ['motor', 'transmision', 'electrico'];

export const RELACIONES: RelacionSimulada[] = [
  { idRelacion: 'REL-1001', cedula: '1020304050', cliente: 'Laura Mejía', telefono: '3015556677', vin: '9FBHJD204PM100001', placa: 'LMX201', kilometraje: 18200, fechaVenta: '2025-03-14', cubre: COMPLETA },
  { idRelacion: 'REL-1002', cedula: '80123456', cliente: 'Carlos Rojas', telefono: '3104445566', vin: '3MZBP2SM1RM200002', placa: 'CRB552', kilometraje: 31500, fechaVenta: '2024-08-02', cubre: COMPLETA },
  { idRelacion: 'REL-1003', cedula: '52987654', cliente: 'Diana Cárdenas', telefono: '3201112233', vin: '9BWAG45U0NT300003', placa: 'DCK834', kilometraje: 42000, fechaVenta: '2023-11-20', cubre: TREN_MOTRIZ },
  { idRelacion: 'REL-1004', cedula: '1015432198', cliente: 'Andrés Pardo', telefono: '3157778899', vin: 'KMHCT41DBMU400004', placa: 'APQ119', kilometraje: 75400, fechaVenta: '2022-05-09', cubre: COMPLETA },
  { idRelacion: 'REL-1005', cedula: '39765432', cliente: 'Marta Gil', telefono: '3009998877', vin: '9FBHJD204LM500005', placa: 'MGL630', kilometraje: 98000, fechaVenta: '2020-02-17', cubre: COMPLETA },
  { idRelacion: 'REL-1006', cedula: '1032456789', cliente: 'Julián Ortiz', telefono: '3186665544', vin: '3MZBP2SM1SM600006', placa: 'JOT741', kilometraje: 6100, fechaVenta: '2026-01-25', cubre: COMPLETA },
  { idRelacion: 'REL-1007', cedula: '79456123', cliente: 'Ricardo Peña', telefono: '3113332211', vin: '9BWAG45U0PT700007', placa: 'RPN908', kilometraje: 22800, fechaVenta: '2024-10-30', cubre: TREN_MOTRIZ },
  { idRelacion: 'REL-1008', cedula: '1098765432', cliente: 'Sofía Vargas', telefono: '3054443322', vin: 'KMHCT41DBRU800008', placa: 'SVG275', kilometraje: 12900, fechaVenta: '2025-07-01', cubre: COMPLETA },
];

// La API pública del VIN: el modelo base sale del prefijo (WMI + descriptor) y el año del
// carácter 10 del VIN.
const MODELOS: Record<string, Omit<CabeceraVin, 'vin' | 'anio'>> = {
  '9FBHJD': { marca: 'Renault', modelo: 'Duster', version: 'Intens 1.3 Turbo', carroceria: 'SUV', puertas: 5, motor: '1.3 L turbo', combustible: 'Gasolina', transmision: 'Automática CVT' },
  '3MZBP2': { marca: 'Mazda', modelo: '3', version: 'Touring Sedán', carroceria: 'Sedán', puertas: 4, motor: '2.0 L Skyactiv-G', combustible: 'Gasolina', transmision: 'Automática 6 vel.' },
  '9BWAG4': { marca: 'Volkswagen', modelo: 'Gol', version: 'Trendline', carroceria: 'Hatchback', puertas: 5, motor: '1.6 L MSI', combustible: 'Gasolina', transmision: 'Manual 5 vel.' },
  KMHCT4: { marca: 'Hyundai', modelo: 'Accent', version: 'GL Coupé', carroceria: 'Coupé', puertas: 2, motor: '1.6 L', combustible: 'Gasolina', transmision: 'Manual 6 vel.' },
};

// Año modelo según el décimo carácter del VIN.
const ANIOS: Record<string, number> = { L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025, T: 2026 };

export function cabeceraSimulada(vin: string): CabeceraVin | null {
  const base = MODELOS[vin.slice(0, 6).toUpperCase()];
  if (!base || vin.length !== 17) return null;
  return { vin: vin.toUpperCase(), ...base, anio: ANIOS[vin[9].toUpperCase()] ?? 0 };
}
