import type { Destino } from './evento.entity';

// Contrato con los otros agentes: qué herramienta MCP llama el taller en cada uno y con
// qué datos. Cuando esos sistemas existan, sus servidores MCP deben exponer estas
// herramientas (o se ajusta aquí el nombre). La documentación completa, con ejemplos,
// está en docs/integracion/.
export const CONTRATO: Record<Destino, { descripcion: string; herramientas: Record<string, string> }> = {
  concesionario: {
    descripcion: 'Concesionario: dueño de la relación cliente–vehículo (id_relacion), de la API del VIN y de la garantía',
    herramientas: {
      consultar_relacion: '{ id_relacion } → cliente, vehículo (cabecera del VIN), kilometraje y garantía vigente',
      decodificar_vin: '{ vin } → marca, modelo, versión, carrocería, puertas, motor…',
      validar_garantia:
        '{ codigo, id_relacion, vin, por_garantia, motivo_reclamo, servicios[{ tarea_id, sku, especialidad, causa, aplica, motivo, evidencias[url] }] } → responde llamando registrar_resultado_garantia en el MCP del taller',
      notificar_estado_vehiculo: '{ codigo, id_relacion, placa, sede, estado, nota, fecha } → acuse de recibo',
    },
  },
  facturacion: {
    descripcion: 'Facturación: cotiza los repuestos con las tiendas, avisa al cliente por Telegram y cobra con PSE',
    herramientas: {
      crear_cotizacion:
        '{ codigo, id_relacion, taller, sede, cliente, vehiculo, mano_obra[{ sku, descripcion, precio, garantia }], repuestos[{ codigo_repuesto, descripcion, cantidad, garantia }], total_mano_obra, mensaje_garantia } → responde llamando registrar_respuesta_cliente',
      notificar_reparacion_terminada:
        '{ codigo, id_relacion, mano_obra_realizada[], servicios_no_realizados[], partes_usadas[], total_mano_obra } → envía el PSE y responde llamando registrar_pago',
    },
  },
};

// Variables de entorno de cada destino: MCP_CONCESIONARIO_URL, MCP_CONCESIONARIO_TOKEN…
export function configuracion(destino: Destino, entorno: Record<string, string | undefined> = process.env) {
  const prefijo = `MCP_${destino.toUpperCase()}`;
  const url = entorno[`${prefijo}_URL`]?.trim();
  return url ? { url, token: entorno[`${prefijo}_TOKEN`]?.trim() || undefined } : null;
}
