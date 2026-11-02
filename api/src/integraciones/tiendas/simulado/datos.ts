import type { RepuestoCatalogo } from '../proveedor';

// Catálogo de PRUEBA de una tienda, mientras no haya MCP_TIENDA_1_URL. Usa los códigos
// universales, los mismos de la tienda real.

export const TIENDA_SIMULADA = 'Tienda simulada';

const CATALOGO: [string, string, string, string[], number][] = [
  ['ACE-5W30-1L', 'Aceite sintético 5W-30, 1 litro', 'Lubricantes', ['Mobil', 'Castrol'], 40],
  ['FIL-ACE-STD', 'Filtro de aceite estándar', 'Filtros', ['Bosch', 'Mann'], 35],
  ['FIL-AIRE-STD', 'Filtro de aire de motor', 'Filtros', ['Bosch'], 20],
  ['PAS-DEL-CER', 'Juego de pastillas delanteras cerámicas', 'Frenos', ['Bosch', 'Brembo'], 11],
  ['PAS-TRA-CER', 'Juego de pastillas traseras cerámicas', 'Frenos', ['Bosch'], 6],
  ['DIS-DEL-VENT', 'Disco de freno delantero ventilado', 'Frenos', ['Brembo'], 6],
  ['LIQ-FRE-DOT4', 'Líquido de frenos DOT 4, 500 ml', 'Frenos', ['Bosch'], 24],
  ['AMO-DEL-GAS', 'Amortiguador delantero a gas', 'Suspensión', ['Monroe'], 8],
  ['AMO-TRA-GAS', 'Amortiguador trasero a gas', 'Suspensión', ['Monroe'], 8],
  ['BUJ-IRI-STD', 'Bujía de iridio', 'Encendido', ['NGK'], 30],
  ['BOB-ENC-STD', 'Bobina de encendido', 'Encendido', ['Bosch'], 6],
  ['BAT-12V-60AH', 'Batería 12 V 60 Ah', 'Eléctrico', ['Willard', 'MAC'], 8],
  ['ALT-90A-STD', 'Alternador 90 A', 'Eléctrico', ['Valeo'], 3],
  ['KIT-EMB-STD', 'Kit de embrague (disco, prensa y balinera)', 'Transmisión', ['LuK'], 4],
  ['SEN-OXI-STD', 'Sensor de oxígeno', 'Motor', ['Denso'], 5],
];

export const REPUESTOS_SIMULADOS: RepuestoCatalogo[] = CATALOGO.map(([codigo_repuesto, nombre, categoria, marcas, unidades_disponibles]) => ({
  codigo_repuesto,
  nombre,
  categoria,
  marcas,
  unidades_disponibles,
  tiendas: [TIENDA_SIMULADA],
}));
