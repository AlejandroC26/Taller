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
      notificar_estado_vehiculo:
        '{ codigo, id_relacion, placa, sede (código, por ejemplo PL-FRENOS), estado, nota? (hasta 300), fecha (ISO -05:00) } → acuse de recibo',
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

// Tiendas de repuestos: el taller solo lee su catálogo por código universal, para que el
// mecánico elija la parte. Facturación cotiza y compra. El precio que devuelven se descarta.
export const CONTRATO_TIENDAS = {
  descripcion: 'Tiendas de repuestos: el taller le pide el catálogo a su agente; facturación cotiza y compra',
  herramientas: {
    hablar_con_repuestos:
      '{ mensaje: "¿Qué repuestos tienen disponibles?…" } → { respuesta, catalogo: { repuestos[{ codigo_repuesto, nombre, categoria, marcas[], unidades_disponibles }] } } (se guarda 5 minutos)',
  },
};

export interface ConfTienda {
  nombre: string;
  url: string;
  token?: string;
}

// MCP_TIENDA_1_URL, MCP_TIENDA_1_TOKEN, MCP_TIENDA_1_NOMBRE… hasta 9 tiendas. Cada tienda
// es su propia instancia: no hay un servicio que las reúna.
export function tiendasConfiguradas(entorno: Record<string, string | undefined> = process.env): ConfTienda[] {
  const tiendas: ConfTienda[] = [];
  for (let n = 1; n <= 9; n++) {
    const url = entorno[`MCP_TIENDA_${n}_URL`]?.trim();
    if (!url) continue;
    tiendas.push({
      nombre: entorno[`MCP_TIENDA_${n}_NOMBRE`]?.trim() || `Tienda ${n}`,
      url,
      token: entorno[`MCP_TIENDA_${n}_TOKEN`]?.trim() || undefined,
    });
  }
  return tiendas;
}

// ---------- Mensajes al concesionario, con los límites de su MCP ----------

const ZONA_COLOMBIA_MS = 5 * 3_600_000;
const enColombia = (instante: Date) => `${new Date(instante.getTime() - ZONA_COLOMBIA_MS).toISOString().slice(0, 19)}-05:00`;
const recortar = (texto: string, maximo: number) => (texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto);

// notificar_estado_vehiculo: la sede va por código, la nota hasta 300 caracteres (sin
// nota si no hay) y la fecha en hora de Colombia.
export function avisoEstado(
  d: { codigo: string; idRelacion: string; placa: string; sede: string; estado: string; nota?: string | null },
  ahora = new Date(),
) {
  return {
    codigo: d.codigo,
    id_relacion: d.idRelacion,
    placa: d.placa,
    sede: d.sede,
    estado: d.estado,
    ...(d.nota ? { nota: recortar(d.nota, 300) } : {}),
    fecha: enColombia(ahora),
  };
}

export interface ServicioSolicitud {
  tareaId: number;
  sku: string;
  especialidad: string;
  causa: string | null;
  aplica: boolean;
  motivo: string | null;
  evidencias: string[];
}

// validar_garantia: motivo_reclamo hasta 300 caracteres y solo si hay; los campos sin
// valor no se envían (su MCP no acepta null); hasta 20 evidencias por servicio.
export function solicitudGarantia(d: {
  codigo: string;
  idRelacion: string;
  vin: string;
  porGarantia: boolean;
  motivoReclamo: string | null;
  servicios: ServicioSolicitud[];
}) {
  return {
    codigo: d.codigo,
    id_relacion: d.idRelacion,
    vin: d.vin,
    por_garantia: d.porGarantia,
    ...(d.motivoReclamo ? { motivo_reclamo: recortar(d.motivoReclamo, 300) } : {}),
    servicios: d.servicios.map((s) => ({
      tarea_id: s.tareaId,
      sku: s.sku,
      especialidad: s.especialidad,
      ...(s.causa ? { causa: s.causa } : {}),
      aplica: s.aplica,
      ...(s.motivo ? { motivo: s.motivo } : {}),
      evidencias: s.evidencias.slice(0, 20),
    })),
    responder_con: 'registrar_resultado_garantia',
  };
}
