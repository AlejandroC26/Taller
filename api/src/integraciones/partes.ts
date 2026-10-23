import { configuracion } from './contrato';
import { llamarHerramienta } from './conector-mcp';

// Consulta en línea al proyecto de partes, para cuando el mecánico necesita una pieza
// que el taller no tiene. Sin MCP configurado responde que no está activo, sin error.
export async function buscarParte(texto: string) {
  if (!configuracion('partes')) {
    return { activo: false, mensaje: 'El proyecto de partes todavía no está conectado', resultados: [] };
  }
  try {
    return { activo: true, resultados: await llamarHerramienta('partes', 'buscar_parte', { texto }, 8_000) };
  } catch (error) {
    return { activo: true, mensaje: (error as Error).message, resultados: [] };
  }
}
