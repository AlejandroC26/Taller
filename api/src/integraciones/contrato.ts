import type { Destino } from './evento.entity';

// Contrato con los otros proyectos: qué herramienta MCP espera el taller en cada uno y
// con qué datos la llama. Cuando esos proyectos existan, sus servidores MCP deben
// exponer estas herramientas (o se ajusta aquí el nombre).
export const CONTRATO: Record<Destino, { descripcion: string; herramientas: Record<string, string> }> = {
  partes: {
    descripcion: 'Proyecto de partes de vehículos: catálogo y pedidos de repuestos',
    herramientas: {
      buscar_parte: '{ texto } → lista de partes con codigo, nombre, precio y disponibilidad',
      solicitar_parte:
        '{ orden, placa, vehiculo, codigo|null, descripcion, cantidad } → confirmación del pedido',
    },
  },
  facturacion: {
    descripcion: 'Proyecto de facturación: emite la factura de la reparación',
    herramientas: {
      emitir_factura:
        '{ orden, cliente{documento,nombre,correo,telefono}, vehiculo{placa,marca,modelo}, origen, lineas[{concepto,cantidad,valor_unitario}], total } → número de factura',
    },
  },
  concesionario: {
    descripcion: 'Sistema del concesionario que envía carros al taller',
    herramientas: {
      notificar_estado_vehiculo:
        '{ referencia_externa, placa, orden, estado, nota, fecha } → acuse de recibo',
    },
  },
};

// Variables de entorno de cada destino: MCP_PARTES_URL, MCP_PARTES_TOKEN…
export function configuracion(destino: Destino, entorno: Record<string, string | undefined> = process.env) {
  const prefijo = `MCP_${destino.toUpperCase()}`;
  const url = entorno[`${prefijo}_URL`]?.trim();
  return url ? { url, token: entorno[`${prefijo}_TOKEN`]?.trim() || undefined } : null;
}
