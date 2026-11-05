import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { NOMBRE_TALLER } from '../config';
import { invalido } from '../comun/errores';
import { validar } from '../comun/http';
import { consultarCotizacion, pagoDto, registrarPago, registrarRespuestaCliente, respuestaClienteDto } from '../cotizaciones/cotizaciones.service';
import { buscarRepuestosParaOrden, finalizarDiagnostico, guardarDiagnostico, remitirOrden, verDiagnostico } from '../diagnosticos/diagnosticos.service';
import { diagnosticoDto, remitirDto } from '../diagnosticos/dto';
import { guardarEvidencia, listarEvidencias } from '../diagnosticos/evidencias.service';
import { CAUSAS, PAGADORES } from '../garantias/reglas';
import { registrarResultadoGarantia, resultadoGarantiaDto } from '../garantias/garantias.service';
import { estadoIntegraciones, reintentar } from '../integraciones/despachador';
import { unaVez } from '../integraciones/idempotencia';
import {
  agendarCita,
  cancelarCita,
  citaDto,
  consultarPrediagnostico,
  filtroOrdenesDto,
  listarOrdenes,
  prediagnosticarDto,
  registrarSalida,
  tomarOrden,
  unaOrden,
} from '../ordenes/ordenes.service';
import { ESTADOS } from '../ordenes/reglas';
import { horasDto, parteDto } from '../reparaciones/dto';
import {
  marcarTarea,
  registrarHoras,
  registrarParteUsada,
  terminarReparacion,
  verReparacion,
} from '../reparaciones/reparaciones.service';
import { listarServicios, registrarServicio, servicioDto } from '../servicios/servicios.service';
import { ESPECIALIDADES, sumarDias, TIPOS_TALLER } from '../talleres/reglas';
import {
  actualizarTaller,
  disponibilidad,
  disponibilidadRango,
  editarTallerDto,
  listarTalleres,
  registrarTaller,
  reservaDto,
  reservarFranja,
  tallerDto,
} from '../talleres/talleres.service';
import type { Actor } from '../usuarios/actor';
import { contratoMarkdown, describirFlujo, flujoMarkdown } from './flujo';

// ---------- Respuestas ----------

// Todo resultado va como texto JSON (para cualquier cliente) y como structuredContent
// (para los agentes que lo validan con el outputSchema).
const resultado = (datos: unknown) => {
  const objeto = Array.isArray(datos) ? { elementos: datos, total: datos.length } : (datos as Record<string, unknown>);
  return { content: [{ type: 'text' as const, text: JSON.stringify(objeto, null, 2) }], structuredContent: objeto };
};

// Un error de negocio vuelve como resultado, para que el agente lo lea y corrija.
const fallo = (error: unknown) => ({
  isError: true,
  content: [{ type: 'text' as const, text: (error as Error).message ?? String(error) }],
});

const seguro = async (accion: () => Promise<unknown>) => {
  try {
    return resultado(await accion());
  } catch (error) {
    return fallo(error);
  }
};

// ---------- Esquemas comunes ----------

const LECTURA = { readOnlyHint: true, openWorldHint: false } as const;
const ESCRIBE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DESTRUYE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

const codigo = z.string().describe('Código de la orden; por ejemplo: OT-0001');
const idMensaje = z
  .string()
  .max(120)
  .optional()
  .describe('Identificador único de esta llamada. Si se repite (un reintento), el taller devuelve lo mismo sin repetir el cambio');
const sede = z.union([z.number().int(), z.string()]).describe('Sede: id numérico o código, por ejemplo PL-FRENOS');

// Toda respuesta sobre una orden trae su estado y la guía para el orquestador.
const SALIDA_ORDEN = z.looseObject({
  codigo: z.string(),
  estado: z.string(),
  siguiente_paso: z.looseObject({ responsable: z.string(), descripcion: z.string() }),
  acciones_disponibles: z.array(z.string()),
});
const SEDE = z.looseObject({
  id: z.number(),
  codigo: z.string(),
  nombre: z.string(),
  ubicacion: z.looseObject({ ciudad: z.string(), direccion: z.string() }),
});
const SIGUIENTE_PASO = z.looseObject({ responsable: z.string(), descripcion: z.string() });
const HORARIO = z.looseObject({
  dias: z.array(z.number()).describe('1 = lunes … 7 = domingo'),
  apertura: z.string().describe('HH:MM, hora de Colombia'),
  cierre: z.string().describe('HH:MM, hora de Colombia'),
});
const SEDE_CON_HORARIO = z.looseObject({ ...SEDE.shape, horario: HORARIO });
const FRANJA = z.looseObject({
  inicio: z.string().describe('ISO 8601 con zona -05:00; por ejemplo 2026-11-05T09:00:00-05:00'),
  libres: z.number().describe('Cupos que quedan en esa franja de una hora'),
});
// agendar_cita: la orden con su sede y la fecha de la cita en hora de Colombia.
const SALIDA_CITA = z.looseObject({
  ...SALIDA_ORDEN.shape,
  sede: SEDE,
  fecha_cita: z.string().describe('ISO 8601 con zona -05:00; por ejemplo 2026-11-03T08:00:00-05:00'),
  por_garantia: z.boolean(),
  motivo_reclamo: z.string().nullable(),
});
const SALIDA_PREDIAGNOSTICO = z.looseObject({
  id_prediagnostico: z.string().describe('PD-0001: envíelo en agendar_cita para agendar con esta misma decisión'),
  id_relacion: z.string(),
  vehiculo: z.string(),
  taller: SEDE_CON_HORARIO.nullable().describe('La sede a la que debe ir el vehículo'),
  especialidad: z.string(),
  ruta: z.enum(['especializada', 'revision_general']),
  confianza: z.number(),
  resumen: z.string(),
  fuente: z.enum(['modelo', 'reglas']).describe('modelo: lo decidió el agente de IA; reglas: palabras clave del catálogo'),
  motivo_decision: z.string().describe('Una o dos frases para el cliente: por qué va a esa sede'),
  servicios_probables: z.array(z.looseObject({ sku: z.string(), nombre: z.string(), precio_mano_obra: z.number() })),
  garantia: z.looseObject({
    vigente: z.boolean(),
    vence: z.string(),
    cubre: z.array(z.string()),
    motivo: z.string().optional(),
    aplica_probable: z.boolean().describe('Estimación: vigente, cubre el sistema y la causa probable no la excluye. La decide el mecánico'),
    causa_probable: z.enum(CAUSAS).nullable().describe('Estimación por lo que cuenta el cliente; null si no hay pistas'),
  }),
  por_garantia: z.boolean(),
  motivo_reclamo: z.string().nullable(),
  sede_sugerida: SEDE.nullable().describe('Igual que taller (se conserva por compatibilidad)'),
  siguiente_paso: SIGUIENTE_PASO,
  acciones_disponibles: z.array(z.string()),
});
const SALIDA_DISPONIBILIDAD = z.looseObject({
  taller: SEDE_CON_HORARIO,
  cupo_por_franja: z.number(),
  franjas: z.array(FRANJA),
});
const SALIDA_RESERVA = z.looseObject({
  id_reserva: z.string().describe('RS-0001: envíelo en agendar_cita'),
  id_relacion: z.string(),
  taller: SEDE_CON_HORARIO,
  fecha_hora: z.string().describe('ISO 8601 con zona -05:00'),
  vence_en: z.string().describe('ISO 8601 con zona -05:00; después la franja se libera'),
  minutos_vigencia: z.number(),
  siguiente_paso: SIGUIENTE_PASO,
  acciones_disponibles: z.array(z.string()),
});

// Entrada común de prediagnosticar y enrutar_garantia.
const ENTRADA_PREDIAGNOSTICO = {
  id_relacion: z.string().describe('Id de la relación cliente–vehículo del concesionario; por ejemplo REL-1001'),
  mensajes_cliente: z.array(z.string()).optional().describe('Lo que el cliente contó, un mensaje por elemento'),
  vin: z.string().optional().describe('VIN de 17 caracteres; si se envía, debe ser el del id_relacion'),
  motivo_reclamo: z.string().optional().describe('Por qué reclama la garantía, en palabras del cliente'),
  kilometraje: z.number().int().optional().describe('Kilometraje actual que reporta el cliente'),
  id_mensaje: idMensaje,
};
type EntradaPrediagnostico = { id_relacion: string; mensajes_cliente?: string[]; vin?: string; motivo_reclamo?: string; kilometraje?: number };
const aPrediagnosticarDto = (e: EntradaPrediagnostico, porGarantia: boolean | undefined) =>
  validar(prediagnosticarDto, {
    idRelacion: e.id_relacion,
    mensajesCliente: e.mensajes_cliente,
    vin: e.vin,
    porGarantia,
    motivoReclamo: e.motivo_reclamo,
    kilometraje: e.kilometraje,
  });
const SALIDA_LISTA = z.looseObject({ elementos: z.array(z.looseObject({})), total: z.number() });
const SALIDA_OBJETO = z.looseObject({});

// ---------- Permisos ----------

// El mecánico ve solo sus herramientas; el agente (concesionario, facturación,
// orquestador…) y el administrador ven todas.
export const HERRAMIENTAS_MECANICO = [
  'describir_flujo',
  'mis_ordenes',
  'estado_orden',
  'tomar_orden',
  'consultar_diagnostico',
  'registrar_diagnostico',
  'adjuntar_evidencia',
  'consultar_evidencias',
  'remitir_orden',
  'finalizar_diagnostico',
  'consultar_reparacion',
  'registrar_horas',
  'registrar_parte_usada',
  'marcar_tarea',
  'terminar_reparacion',
  'consultar_servicios',
  'buscar_repuestos_tienda',
  'listar_talleres',
];

export function herramientasDe(rol: string, todas: string[]): string[] {
  if (rol === 'agente' || rol === 'administrador') return todas;
  if (rol === 'mecanico') return todas.filter((h) => HERRAMIENTAS_MECANICO.includes(h));
  return [];
}

// ---------- Servidor ----------

// Se crea un servidor por petición, para el usuario dueño del token.
export function crearServidorMcp(actor: Actor): McpServer {
  const servidor = new McpServer(
    { name: 'taller-pulgas-locas', version: '2.0.0' },
    {
      instructions:
        `MCP de ${NOMBRE_TALLER} (S.A.S. con varias sedes). Usuario: ${actor.nombre} ${actor.apellido}, rol ${actor.rol}. ` +
        'Lea el recurso taller://flujo (o llame describir_flujo) para entender los estados. Cada respuesta sobre una ' +
        'orden trae siguiente_paso (qué falta y quién lo hace) y acciones_disponibles (qué herramientas llamar ahora). ' +
        'Envíe id_mensaje en las llamadas que cambian algo: si reintenta, no se repite el cambio. Montos en pesos colombianos.',
    },
  );

  // Se registran todas y luego se quitan las que el rol no puede ver.
  const registradas = new Map<string, { remove: () => void }>();
  const registrar = <T>(nombre: string, registro: T) => {
    registradas.set(nombre, registro as unknown as { remove: () => void });
  };

  // ===== Orquestación =====
  registrar(
    'describir_flujo',
    servidor.registerTool(
      'describir_flujo',
      {
        title: 'Describir el flujo',
        description: 'Estados de una orden, a cuáles puede pasar, quién la mueve en cada uno y con qué herramientas; y lo que el taller les envía a los otros agentes.',
        outputSchema: SALIDA_OBJETO,
        annotations: LECTURA,
      },
      () => seguro(async () => describirFlujo()),
    ),
  );

  registrar(
    'estado_orden',
    servidor.registerTool(
      'estado_orden',
      {
        title: 'Estado de una orden',
        description: 'Detalle de una orden: sede, cliente y vehículo, garantía del vehículo, prediagnóstico, historial, siguiente_paso y acciones_disponibles.',
        inputSchema: z.object({ codigo }),
        outputSchema: SALIDA_ORDEN,
        annotations: LECTURA,
      },
      ({ codigo: c }) => seguro(() => unaOrden(actor, c)),
    ),
  );

  registrar(
    'listar_ordenes',
    servidor.registerTool(
      'listar_ordenes',
      {
        title: 'Listar órdenes',
        description: 'Órdenes filtradas por estado, sede o id_relacion (las más recientes primero).',
        inputSchema: z.object({
          estado: z.enum(ESTADOS).optional(),
          taller: z.number().int().optional().describe('id de la sede'),
          id_relacion: z.string().optional(),
          abiertas: z.boolean().optional().describe('true: solo las que no están entregadas ni canceladas'),
        }),
        outputSchema: SALIDA_LISTA,
        annotations: LECTURA,
      },
      ({ estado, taller, id_relacion, abiertas }) =>
        seguro(async () => {
          const ordenes = await listarOrdenes(actor, validar(filtroOrdenesDto, { estado, tallerId: taller, idRelacion: id_relacion, abiertas }));
          // Los agentes no necesitan los datos personales del cliente en el listado (la web sí).
          return ordenes.map(({ cliente: _cliente, ...orden }) => orden);
        }),
    ),
  );

  // ===== Concesionario =====
  registrar(
    'listar_talleres',
    servidor.registerTool(
      'listar_talleres',
      {
        title: 'Listar sedes',
        description: 'Sedes de la S.A.S. con su tipo (mantenimiento o especializado), especialidades, ubicación y horario.',
        inputSchema: z.object({ especialidad: z.enum(ESPECIALIDADES).optional(), ciudad: z.string().optional() }),
        outputSchema: SALIDA_LISTA,
        annotations: LECTURA,
      },
      ({ especialidad, ciudad }) => seguro(() => listarTalleres({ especialidad, ciudad })),
    ),
  );

  registrar(
    'prediagnosticar',
    servidor.registerTool(
      'prediagnosticar',
      {
        title: 'Prediagnóstico (servicio de diagnóstico del taller)',
        description:
          'El agente de prediagnóstico lee lo que el cliente le contó al concesionario y decide a qué sede va el vehículo (taller), con la especialidad, los servicios probables con su precio, la confianza, ' +
          'la ruta ("especializada": directo a la sede especialista; "revision_general": primero a mantenimiento), motivo_decision para el cliente y la garantía del vehículo. ' +
          'Devuelve id_prediagnostico: agende con él para no recalcular. Responde en menos de 30 s; si no alcanza, devuelve un error para reintentar.',
        inputSchema: z.object({ ...ENTRADA_PREDIAGNOSTICO, por_garantia: z.boolean().optional() }),
        outputSchema: SALIDA_PREDIAGNOSTICO,
        annotations: ESCRIBE,
      },
      (e) => seguro(() => unaVez(e.id_mensaje, 'prediagnosticar', () => consultarPrediagnostico(aPrediagnosticarDto(e, e.por_garantia)))),
    ),
  );

  registrar(
    'enrutar_garantia',
    servidor.registerTool(
      'enrutar_garantia',
      {
        title: 'Enrutar un reclamo de garantía',
        description:
          'Para un cliente que viene por garantía: con el motivo del reclamo decide a qué sede va el vehículo y responde lo mismo que prediagnosticar, con por_garantia en true, ' +
          'garantia.aplica_probable y garantia.causa_probable. Si no hay una especialidad clara, manda a revisión general y lo explica en motivo_decision. ' +
          'Agende con el id_prediagnostico que devuelve. Responde en menos de 30 s; si no alcanza, devuelve un error para reintentar.',
        inputSchema: z.object({
          ...ENTRADA_PREDIAGNOSTICO,
          motivo_reclamo: z.string().min(1).describe('Por qué reclama la garantía, en palabras del cliente'),
          por_garantia: z.boolean().optional().describe('Siempre true; se acepta por compatibilidad'),
        }),
        outputSchema: SALIDA_PREDIAGNOSTICO,
        annotations: ESCRIBE,
      },
      (e) => seguro(() => unaVez(e.id_mensaje, 'enrutar_garantia', () => consultarPrediagnostico(aPrediagnosticarDto(e, true)))),
    ),
  );

  registrar(
    'consultar_disponibilidad',
    servidor.registerTool(
      'consultar_disponibilidad',
      {
        title: 'Disponibilidad de una sede',
        description:
          'Franjas de una hora para agendar en una sede. Con desde y hasta (AAAA-MM-DD, hasta 14 días) devuelve solo las franjas libres del rango; ' +
          'con fecha, todas las de ese día con los cupos que quedan. Las horas apartadas con reservar_franja cuentan como ocupadas.',
        inputSchema: z.object({
          taller: sede,
          fecha: z.string().optional().describe('AAAA-MM-DD: un solo día'),
          desde: z.string().optional().describe('AAAA-MM-DD: primer día del rango'),
          hasta: z.string().optional().describe('AAAA-MM-DD: último día del rango (incluido); si falta, una semana desde "desde"'),
        }),
        outputSchema: SALIDA_DISPONIBILIDAD,
        annotations: LECTURA,
      },
      ({ taller, fecha, desde, hasta }) =>
        seguro(async () => {
          if (desde) return disponibilidadRango(taller, desde, hasta ?? sumarDias(desde, 6));
          if (fecha) return disponibilidad(taller, fecha);
          throw invalido('Envíe fecha, o desde y hasta');
        }),
    ),
  );

  registrar(
    'reservar_franja',
    servidor.registerTool(
      'reservar_franja',
      {
        title: 'Apartar una franja',
        description:
          'Aparta por 10 minutos una franja libre para un vehículo mientras el cliente confirma la hora, para que nadie más la tome. ' +
          'Si el vehículo ya tenía otra hora apartada, esa se libera. Agende con el id_reserva que devuelve.',
        inputSchema: z.object({
          taller: sede,
          fecha_hora: z.string().describe('ISO 8601 con zona, el inicio de una franja libre; por ejemplo 2026-11-05T09:00:00-05:00'),
          id_relacion: z.string(),
          id_mensaje: idMensaje,
        }),
        outputSchema: SALIDA_RESERVA,
        annotations: ESCRIBE,
      },
      (e) =>
        seguro(() =>
          unaVez(e.id_mensaje, 'reservar_franja', () =>
            reservarFranja(validar(reservaDto, { taller: e.taller, fechaHora: e.fecha_hora, idRelacion: e.id_relacion })),
          ),
        ),
    ),
  );

  registrar(
    'agendar_cita',
    servidor.registerTool(
      'agendar_cita',
      {
        title: 'Agendar cita',
        description:
          'Agenda el vehículo en una sede y crea la orden en estado agendada. Con id_prediagnostico usa esa decisión (sede, especialidad, mensajes y garantía) sin volver a calcularla; ' +
          'con id_reserva usa la hora y la sede apartadas. Sin ninguno, envíe fecha_hora y los mensajes del cliente: el taller calcula el prediagnóstico. ' +
          'Marque por_garantia si el cliente reclama garantía.',
        inputSchema: z.object({
          id_relacion: z.string(),
          id_prediagnostico: z.string().optional().describe('PD-0001, de prediagnosticar o enrutar_garantia'),
          id_reserva: z.string().optional().describe('RS-0001, de reservar_franja'),
          fecha_hora: z.string().optional().describe('ISO 8601 con zona, en una franja libre; por ejemplo 2026-10-27T09:00:00-05:00. Obligatoria sin id_reserva'),
          taller: sede.optional(),
          mensajes_cliente: z.array(z.string()).optional(),
          sintomas: z.string().optional(),
          kilometraje: z.number().int().optional(),
          por_garantia: z.boolean().optional(),
          motivo_reclamo: z.string().optional(),
          id_mensaje: idMensaje,
        }),
        outputSchema: SALIDA_CITA,
        annotations: ESCRIBE,
      },
      (e) =>
        seguro(() =>
          unaVez(e.id_mensaje, 'agendar_cita', () =>
            agendarCita(
              actor,
              validar(citaDto, {
                idRelacion: e.id_relacion,
                idPrediagnostico: e.id_prediagnostico,
                idReserva: e.id_reserva,
                fechaHora: e.fecha_hora,
                taller: e.taller,
                mensajesCliente: e.mensajes_cliente,
                sintomas: e.sintomas,
                kilometraje: e.kilometraje,
                porGarantia: e.por_garantia,
                motivoReclamo: e.motivo_reclamo,
              }),
            ),
          ),
        ),
    ),
  );

  registrar(
    'cancelar_cita',
    servidor.registerTool(
      'cancelar_cita',
      {
        title: 'Cancelar orden',
        description: 'Cancela la cita u orden mientras no haya empezado la reparación. No se puede deshacer.',
        inputSchema: z.object({ codigo, motivo: z.string().min(5), id_mensaje: idMensaje }),
        outputSchema: SALIDA_ORDEN,
        annotations: DESTRUYE,
      },
      ({ codigo: c, motivo, id_mensaje }) => seguro(() => unaVez(id_mensaje, 'cancelar_cita', () => cancelarCita(actor, c, motivo))),
    ),
  );

  registrar(
    'consultar_evidencias',
    servidor.registerTool(
      'consultar_evidencias',
      {
        title: 'Evidencias de una orden',
        description: 'Fotos y PDF que adjuntó el mecánico, con la URL de descarga (GET con el mismo token web del taller).',
        inputSchema: z.object({ codigo }),
        outputSchema: SALIDA_LISTA,
        annotations: LECTURA,
      },
      ({ codigo: c }) => seguro(() => listarEvidencias(actor, c)),
    ),
  );

  registrar(
    'registrar_resultado_garantia',
    servidor.registerTool(
      'registrar_resultado_garantia',
      {
        title: 'Resultado de la garantía (concesionario)',
        description:
          'Respuesta del concesionario a validar_garantia: por cada servicio (tarea_id) si la garantía es válida y por qué. ' +
          'La orden pasa a en_cotizacion y se le envía la cotización a facturación con ese resultado.',
        inputSchema: z.object({
          codigo,
          resultados: z.array(z.object({ tarea_id: z.number().int(), valida: z.boolean(), motivo: z.string() })).min(1),
          id_mensaje: idMensaje,
        }),
        outputSchema: SALIDA_ORDEN,
        annotations: ESCRIBE,
      },
      ({ codigo: c, resultados, id_mensaje }) =>
        seguro(() => {
          const { resultados: r } = validar(resultadoGarantiaDto, {
            resultados: resultados.map((x) => ({ tareaId: x.tarea_id, valida: x.valida, motivo: x.motivo })),
          });
          return registrarResultadoGarantia(actor, c, r, id_mensaje);
        }),
    ),
  );

  // ===== Facturación =====
  registrar(
    'consultar_cotizacion',
    servidor.registerTool(
      'consultar_cotizacion',
      {
        title: 'Cotización de una orden',
        description:
          'Mano de obra con su precio (SKU) y repuestos a comprar (código universal y cantidad, sin precio), cada línea con su garantía y quién paga, ' +
          'más el mensaje_garantia para el cliente y la orden de compra ya registrada.',
        inputSchema: z.object({ codigo }),
        outputSchema: SALIDA_OBJETO,
        annotations: LECTURA,
      },
      ({ codigo: c }) => seguro(() => consultarCotizacion(actor, c)),
    ),
  );

  registrar(
    'registrar_respuesta_cliente',
    servidor.registerTool(
      'registrar_respuesta_cliente',
      {
        title: 'Respuesta del cliente a la cotización (facturación)',
        description:
          'El cliente aceptó o rechazó por Telegram. Si aceptó, envíe la orden de compra que armó con las tiendas (repuesto, tienda, precio): la orden pasa a aprobada. ' +
          'Si rechazó, pasa a rechazada y el vehículo sale sin reparar.',
        inputSchema: z.object({
          codigo,
          aceptada: z.boolean(),
          motivo: z.string().optional(),
          referencia: z.string().optional().describe('Referencia de la cotización en facturación'),
          orden_compra: z
            .array(
              z.object({
                codigo_repuesto: z.string().describe('Código universal (el de la cotización)'),
                descripcion: z.string().optional(),
                cantidad: z.number().int(),
                tienda: z.string(),
                precio_unitario: z.number(),
                pagador: z.enum(PAGADORES).optional(),
              }),
            )
            .optional(),
          id_mensaje: idMensaje,
        }),
        outputSchema: SALIDA_ORDEN,
        annotations: ESCRIBE,
      },
      (e) =>
        seguro(() =>
          registrarRespuestaCliente(
            actor,
            e.codigo,
            validar(respuestaClienteDto, {
              aceptada: e.aceptada,
              motivo: e.motivo,
              referencia: e.referencia,
              ordenCompra: (e.orden_compra ?? []).map((l) => ({
                codigoRepuesto: l.codigo_repuesto,
                descripcion: l.descripcion,
                cantidad: l.cantidad,
                tienda: l.tienda,
                precioUnitario: l.precio_unitario,
                pagador: l.pagador,
              })),
            }),
            e.id_mensaje,
          ),
        ),
    ),
  );

  registrar(
    'registrar_pago',
    servidor.registerTool(
      'registrar_pago',
      {
        title: 'Pago confirmado (facturación)',
        description: 'El cliente pagó el PSE: la orden pasa a facturada y el vehículo puede salir.',
        inputSchema: z.object({ codigo, referencia_pse: z.string(), valor: z.number(), id_mensaje: idMensaje }),
        outputSchema: SALIDA_ORDEN,
        annotations: ESCRIBE,
      },
      ({ codigo: c, referencia_pse, valor, id_mensaje }) =>
        seguro(() => registrarPago(actor, c, validar(pagoDto, { referenciaPse: referencia_pse, valor }), id_mensaje)),
    ),
  );

  // ===== Mecánico =====
  registrar(
    'mis_ordenes',
    servidor.registerTool(
      'mis_ordenes',
      {
        title: 'Mis órdenes',
        description: 'Para el mecánico: "mias" (asignadas) o "cola" (de su sede esperando mecánico). Para un agente: las abiertas.',
        inputSchema: z.object({ vista: z.enum(['mias', 'cola']).optional() }),
        outputSchema: SALIDA_LISTA,
        annotations: LECTURA,
      },
      ({ vista }) => seguro(() => listarOrdenes(actor, actor.rol === 'mecanico' ? { vista: vista ?? 'mias' } : { abiertas: true })),
    ),
  );

  registrar(
    'tomar_orden',
    servidor.registerTool(
      'tomar_orden',
      {
        title: 'Tomar una orden',
        description:
          'Un mecánico de la sede toma la orden: si está agendada o remitida, para diagnosticarla; si está aprobada, para repararla. Un agente debe indicar mecanico_id.',
        inputSchema: z.object({ codigo, mecanico_id: z.string().optional(), id_mensaje: idMensaje }),
        outputSchema: SALIDA_ORDEN,
        annotations: ESCRIBE,
      },
      ({ codigo: c, mecanico_id, id_mensaje }) => seguro(() => unaVez(id_mensaje, 'tomar_orden', () => tomarOrden(actor, c, mecanico_id))),
    ),
  );

  registrar(
    'consultar_diagnostico',
    servidor.registerTool(
      'consultar_diagnostico',
      {
        title: 'Consultar diagnóstico',
        description: 'Servicios (SKU y precio), causa, dictamen de garantía del mecánico, respuesta del concesionario, repuestos a comprar y evidencias.',
        inputSchema: z.object({ codigo }),
        outputSchema: SALIDA_OBJETO,
        annotations: LECTURA,
      },
      ({ codigo: c }) => seguro(() => verDiagnostico(actor, c)),
    ),
  );

  registrar(
    'registrar_diagnostico',
    servidor.registerTool(
      'registrar_diagnostico',
      {
        title: 'Registrar diagnóstico (borrador)',
        description:
          'Guarda el borrador: cada servicio es un SKU del catálogo, con la causa de la falla, el dictamen de garantía del mecánico (aplica o no y por qué) ' +
          'y los repuestos a comprar, elegidos con buscar_repuestos_tienda (codigo_repuesto y cantidad). Con id se actualiza un servicio; sin id se crea; los que no se envíen se borran.',
        inputSchema: z.object({
          codigo,
          observaciones: z.string().optional(),
          servicios: z.array(
            z.object({
              id: z.number().int().optional(),
              sku: z.string().describe('SKU según consultar_servicios'),
              descripcion: z.string().optional(),
              causa: z.enum(CAUSAS).nullable().optional(),
              garantia_aplica: z.boolean().optional().describe('Dictamen del mecánico; si se omite, el sugerido por la causa'),
              garantia_motivo: z.string().optional(),
              repuestos: z
                .array(
                  z.object({
                    codigo_repuesto: z.string().describe('Código universal, según buscar_repuestos_tienda; por ejemplo PAS-DEL-CER'),
                    cantidad: z.number().int(),
                  }),
                )
                .optional(),
            }),
          ),
        }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      (e) =>
        seguro(() =>
          guardarDiagnostico(
            actor,
            e.codigo,
            validar(diagnosticoDto, {
              observaciones: e.observaciones,
              tareas: e.servicios.map((s) => ({
                id: s.id,
                sku: s.sku,
                descripcion: s.descripcion,
                causa: s.causa ?? null,
                garantiaAplica: s.garantia_aplica,
                garantiaMotivo: s.garantia_motivo,
                repuestos: (s.repuestos ?? []).map((r) => ({ codigoRepuesto: r.codigo_repuesto, cantidad: r.cantidad })),
              })),
            }),
          ),
        ),
    ),
  );

  registrar(
    'adjuntar_evidencia',
    servidor.registerTool(
      'adjuntar_evidencia',
      {
        title: 'Adjuntar evidencia',
        description: 'Foto (JPG, PNG, WEBP) o PDF en base64, máximo 5 MB, de la orden o de un servicio (tarea_id). Respalda el dictamen de garantía.',
        inputSchema: z.object({ codigo, nombre: z.string(), contenido_base64: z.string(), tarea_id: z.number().int().optional() }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      ({ codigo: c, nombre, contenido_base64, tarea_id }) =>
        seguro(() => guardarEvidencia(actor, c, { nombre, datos: new Uint8Array(Buffer.from(contenido_base64, 'base64')), tareaId: tarea_id })),
    ),
  );

  registrar(
    'remitir_orden',
    servidor.registerTool(
      'remitir_orden',
      {
        title: 'Remitir a sede especializada',
        description: 'Después de la revisión general, pasa la orden a una sede especializada. La revisión general queda cobrada como servicio fijo.',
        inputSchema: z.object({ codigo, taller: sede, nota: z.string().min(5), id_mensaje: idMensaje }),
        outputSchema: SALIDA_ORDEN,
        annotations: ESCRIBE,
      },
      ({ codigo: c, taller, nota, id_mensaje }) =>
        seguro(() => {
          const d = validar(remitirDto, { taller, nota });
          return unaVez(id_mensaje, 'remitir_orden', () => remitirOrden(actor, c, d.taller, d.nota));
        }),
    ),
  );

  registrar(
    'finalizar_diagnostico',
    servidor.registerTool(
      'finalizar_diagnostico',
      {
        title: 'Finalizar diagnóstico',
        description:
          'Cierra el diagnóstico y lo envía al concesionario para validar la garantía (toda orden se consulta). Exige el motivo de cada dictamen y evidencias si el dictamen dice que aplica o la orden vino por garantía.',
        inputSchema: z.object({ codigo, id_mensaje: idMensaje }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      ({ codigo: c, id_mensaje }) => seguro(() => unaVez(id_mensaje, 'finalizar_diagnostico', () => finalizarDiagnostico(actor, c))),
    ),
  );

  registrar(
    'consultar_reparacion',
    servidor.registerTool(
      'consultar_reparacion',
      {
        title: 'Consultar reparación',
        description: 'Servicios hechos, horas (control), orden de compra de facturación, partes usadas y mano de obra realizada.',
        inputSchema: z.object({ codigo }),
        outputSchema: SALIDA_OBJETO,
        annotations: LECTURA,
      },
      ({ codigo: c }) => seguro(() => verReparacion(actor, c)),
    ),
  );

  registrar(
    'registrar_horas',
    servidor.registerTool(
      'registrar_horas',
      {
        title: 'Registrar horas',
        description: 'Tiempo trabajado en la reparación (control de productividad; la mano de obra se cobra por SKU).',
        inputSchema: z.object({
          codigo,
          inicio: z.string().describe('ISO 8601 con zona'),
          fin: z.string().describe('ISO 8601 con zona'),
          tarea_id: z.number().int().optional(),
          nota: z.string().optional(),
          mecanico_id: z.string().optional(),
        }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      (e) =>
        seguro(() =>
          registrarHoras(actor, e.codigo, validar(horasDto, { inicio: e.inicio, fin: e.fin, tareaId: e.tarea_id, nota: e.nota, mecanicoId: e.mecanico_id })),
        ),
    ),
  );

  registrar(
    'registrar_parte_usada',
    servidor.registerTool(
      'registrar_parte_usada',
      {
        title: 'Registrar parte usada',
        description: 'Deja constancia de un repuesto usado y gastado (código universal y cantidad); puede enlazarse a una línea de la orden de compra.',
        inputSchema: z.object({
          codigo,
          codigo_repuesto: z.string(),
          cantidad: z.number().int(),
          descripcion: z.string().optional(),
          compra_id: z.number().int().optional(),
          nota: z.string().optional(),
        }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      (e) =>
        seguro(() =>
          registrarParteUsada(
            actor,
            e.codigo,
            validar(parteDto, { codigoRepuesto: e.codigo_repuesto, cantidad: e.cantidad, descripcion: e.descripcion, compraId: e.compra_id, nota: e.nota }),
          ),
        ),
    ),
  );

  registrar(
    'marcar_tarea',
    servidor.registerTool(
      'marcar_tarea',
      {
        title: 'Marcar servicio hecho',
        description: 'Marca o desmarca un servicio del diagnóstico como realizado.',
        inputSchema: z.object({ codigo, tarea_id: z.number().int(), completada: z.boolean() }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      ({ codigo: c, tarea_id, completada }) => seguro(() => marcarTarea(actor, c, tarea_id, completada)),
    ),
  );

  registrar(
    'terminar_reparacion',
    servidor.registerTool(
      'terminar_reparacion',
      {
        title: 'Terminar reparación',
        description: 'Cierra la reparación: queda pendiente de facturación y se le envía a facturación lo hecho y lo usado para que cobre con PSE.',
        inputSchema: z.object({ codigo, id_mensaje: idMensaje }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      ({ codigo: c, id_mensaje }) => seguro(() => unaVez(id_mensaje, 'terminar_reparacion', () => terminarReparacion(actor, c))),
    ),
  );

  registrar(
    'consultar_servicios',
    servidor.registerTool(
      'consultar_servicios',
      {
        title: 'Catálogo de servicios',
        description: 'SKU de la S.A.S. con su precio fijo de mano de obra y horas estándar.',
        inputSchema: z.object({ especialidad: z.enum(ESPECIALIDADES).optional() }),
        outputSchema: SALIDA_LISTA,
        annotations: LECTURA,
      },
      ({ especialidad }) => seguro(() => listarServicios(especialidad)),
    ),
  );

  registrar(
    'buscar_repuestos_tienda',
    servidor.registerTool(
      'buscar_repuestos_tienda',
      {
        title: 'Buscar repuestos en el catálogo de la tienda',
        description:
          'Busca en el catálogo de la tienda de repuestos, por código universal (por ejemplo PAS-DEL-CER), nombre o categoría. ' +
          'Devuelve código, nombre, categoría, marcas y unidades disponibles, sin precio: el precio lo consigue facturación. ' +
          'Use codigo_repuesto en registrar_diagnostico. El catálogo se guarda unos minutos; refrescar=true lo pide de nuevo.',
        inputSchema: z.object({
          codigo,
          texto: z.string().optional().describe('Parte del código, el nombre o la categoría; por ejemplo: pastillas'),
          categoria: z.string().optional().describe('Solo esta categoría; por ejemplo: Frenos'),
          refrescar: z.boolean().optional().describe('true para pedir el catálogo otra vez a la tienda'),
        }),
        outputSchema: z.looseObject({
          tiendas: z.array(z.string()),
          sin_respuesta: z.array(z.string()),
          actualizado_en: z.string().nullable(),
          categorias: z.array(z.string()),
          repuestos: z.array(
            z.looseObject({
              codigo_repuesto: z.string(),
              nombre: z.string(),
              categoria: z.string(),
              marcas: z.array(z.string()),
              unidades_disponibles: z.number(),
            }),
          ),
        }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      (e) => seguro(() => buscarRepuestosParaOrden(actor, e.codigo, { texto: e.texto, categoria: e.categoria, refrescar: e.refrescar })),
    ),
  );

  // ===== Administración =====
  registrar(
    'registrar_taller',
    servidor.registerTool(
      'registrar_taller',
      {
        title: 'Registrar sede',
        description: 'Crea una sede de la S.A.S. con su tipo, especialidades, ubicación y horario.',
        inputSchema: z.object({
          codigo: z.string(),
          nombre: z.string(),
          tipo: z.enum(TIPOS_TALLER),
          especialidades: z.array(z.enum(ESPECIALIDADES)),
          ciudad: z.string(),
          direccion: z.string(),
          latitud: z.number().optional(),
          longitud: z.number().optional(),
          telefono: z.string().optional(),
          horario: z.object({ dias: z.array(z.number().int()), apertura: z.string(), cierre: z.string() }),
        }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      (datos) => seguro(() => registrarTaller(validar(tallerDto, datos))),
    ),
  );

  registrar(
    'actualizar_taller',
    servidor.registerTool(
      'actualizar_taller',
      {
        title: 'Actualizar sede',
        description: 'Cambia datos de una sede (nombre, especialidades, ubicación, horario, activa).',
        inputSchema: z.object({
          taller: sede,
          nombre: z.string().optional(),
          tipo: z.enum(TIPOS_TALLER).optional(),
          especialidades: z.array(z.enum(ESPECIALIDADES)).optional(),
          ciudad: z.string().optional(),
          direccion: z.string().optional(),
          telefono: z.string().optional(),
          horario: z.object({ dias: z.array(z.number().int()), apertura: z.string(), cierre: z.string() }).optional(),
          activo: z.boolean().optional(),
        }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      ({ taller, ...datos }) => seguro(() => actualizarTaller(taller, validar(editarTallerDto, datos))),
    ),
  );

  registrar(
    'registrar_servicio',
    servidor.registerTool(
      'registrar_servicio',
      {
        title: 'Registrar servicio (SKU)',
        description: 'Crea o actualiza un SKU del catálogo con su precio de mano de obra y palabras clave para el prediagnóstico.',
        inputSchema: z.object({
          sku: z.string(),
          nombre: z.string(),
          especialidad: z.enum(ESPECIALIDADES),
          precio_mano_obra: z.number(),
          horas_estandar: z.number(),
          palabras_clave: z.array(z.string()).optional(),
          descripcion: z.string().optional(),
          activo: z.boolean().optional(),
        }),
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      (e) =>
        seguro(() =>
          registrarServicio(
            validar(servicioDto, {
              sku: e.sku,
              nombre: e.nombre,
              especialidad: e.especialidad,
              precioManoObra: e.precio_mano_obra,
              horasEstandar: e.horas_estandar,
              palabrasClave: e.palabras_clave,
              descripcion: e.descripcion,
              activo: e.activo,
            }),
          ),
        ),
    ),
  );

  registrar(
    'registrar_salida',
    servidor.registerTool(
      'registrar_salida',
      {
        title: 'Registrar salida del vehículo',
        description: 'El vehículo sale del taller: pagado (facturada) o sin reparar (rechazada).',
        inputSchema: z.object({ codigo, nota: z.string().optional(), id_mensaje: idMensaje }),
        outputSchema: SALIDA_ORDEN,
        annotations: ESCRIBE,
      },
      ({ codigo: c, nota, id_mensaje }) => seguro(() => unaVez(id_mensaje, 'registrar_salida', () => registrarSalida(actor, c, nota))),
    ),
  );

  registrar(
    'consultar_bandeja',
    servidor.registerTool(
      'consultar_bandeja',
      {
        title: 'Bandeja de salida',
        description: 'Mensajes que el taller les envía a los otros agentes (concesionario, facturación) y su estado de envío.',
        outputSchema: SALIDA_OBJETO,
        annotations: LECTURA,
      },
      () => seguro(() => estadoIntegraciones()),
    ),
  );

  registrar(
    'reintentar_envios',
    servidor.registerTool(
      'reintentar_envios',
      {
        title: 'Reintentar envíos',
        description: 'Vuelve a enviar los mensajes fallidos o sin destino configurado.',
        outputSchema: SALIDA_OBJETO,
        annotations: ESCRIBE,
      },
      () => seguro(() => reintentar()),
    ),
  );

  // ===== Recursos: para que un agente entienda el sistema sin leer el código =====
  servidor.registerResource('flujo', 'taller://flujo', { title: 'Flujo de una orden', mimeType: 'text/markdown' }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: flujoMarkdown() }],
  }));
  servidor.registerResource('contrato', 'taller://contrato', { title: 'Contrato con los otros agentes', mimeType: 'text/markdown' }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: contratoMarkdown() }],
  }));
  servidor.registerResource('talleres', 'taller://talleres', { title: 'Sedes', mimeType: 'application/json' }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await listarTalleres(), null, 2) }],
  }));
  servidor.registerResource('servicios', 'taller://servicios', { title: 'Catálogo de servicios', mimeType: 'application/json' }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await listarServicios(), null, 2) }],
  }));

  // Se quitan las herramientas que el rol no puede ver.
  const permitidas = new Set(herramientasDe(actor.rol, [...registradas.keys()]));
  for (const [nombre, registro] of registradas) if (!permitidas.has(nombre)) registro.remove();

  return servidor;
}
