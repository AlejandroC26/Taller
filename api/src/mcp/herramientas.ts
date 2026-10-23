import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { crearCliente, crearVehiculo, listarClientes } from '../clientes/clientes.service';
import { clienteDto, vehiculoDto } from '../clientes/dto';
import { validar } from '../comun/http';
import { finalizarDiagnostico, guardarDiagnostico, verDiagnostico } from '../diagnosticos/diagnosticos.service';
import { diagnosticoDto } from '../diagnosticos/dto';
import { estadoVehiculo, ingresoDto, registrarIngreso } from '../integraciones/concesionario';
import { movimientoDto } from '../inventario/dto';
import { listarItems, registrarMovimiento } from '../inventario/inventario.service';
import { nuevaOrdenDto } from '../ordenes/dto';
import {
  asignar,
  cambiarEstado,
  cancelar,
  crearOrden,
  disponibilidad,
  listarOrdenes,
  panel,
  unaOrden,
} from '../ordenes/ordenes.service';
import { ESTADOS, ETAPAS } from '../ordenes/reglas';
import { horasDto } from '../reparaciones/dto';
import {
  marcarTarea,
  registrarHoras,
  registrarParte,
  terminarReparacion,
  verReparacion,
} from '../reparaciones/reparaciones.service';
import type { Actor } from '../usuarios/actor';
import { PERSONAL, TALLER } from '../usuarios/rol.entity';

const resultado = (datos: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(datos, null, 2) }],
});

// Un error de negocio se devuelve como resultado, para que el modelo lo lea y
// corrija.
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

const LECTURA = { readOnlyHint: true } as const;
const ESCRIBE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const codigo = z.string().describe('Código de la orden; por ejemplo: OT-0001');

// Los esquemas de las herramientas son simples (sin transformaciones) para que se
// puedan describir en JSON Schema; los DTO de la API normalizan y validan dentro.
const esquemaCliente = z.object({
  nombre: z.string(),
  apellido: z.string(),
  documento: z.string(),
  telefono: z.string(),
  correo: z.string().optional(),
  direccion: z.string().optional(),
});
const esquemaVehiculo = z.object({
  placa: z.string().describe('Placa; por ejemplo: ABC123'),
  marca: z.string(),
  modelo: z.string(),
  anio: z.number().int(),
  color: z.string().optional(),
  kilometraje: z.number().int().optional(),
});

// Las herramientas que ve cada rol. Se exporta para probarlo sin levantar el servidor.
export function herramientasDe(rol: string): string[] {
  const lista: string[] = [];
  if (TALLER.includes(rol)) {
    lista.push('consultar_ordenes', 'consultar_diagnostico', 'consultar_reparacion', 'consultar_inventario');
  }
  if (rol === 'mecanico' || rol === 'administrador') {
    lista.push(
      'registrar_diagnostico',
      'finalizar_diagnostico',
      'registrar_horas',
      'registrar_parte_usada',
      'marcar_tarea',
      'terminar_reparacion',
    );
  }
  if (PERSONAL.includes(rol)) {
    lista.push(
      'panel_taller',
      'consultar_disponibilidad',
      'asignar_mecanico',
      'buscar_clientes',
      'registrar_cliente',
      'registrar_vehiculo',
      'crear_orden',
      'cambiar_estado_orden',
      'actualizar_inventario',
      'cancelar_orden',
    );
  }
  if (rol === 'concesionario' || PERSONAL.includes(rol)) {
    lista.push('registrar_ingreso_vehiculo', 'estado_vehiculo');
  }
  return lista;
}

// Se crea un servidor por petición y para un usuario concreto: cada rol ve solo sus
// herramientas.
export function crearServidorMcp(actor: Actor): McpServer {
  const permitidas = new Set(herramientasDe(actor.rol));
  const servidor = new McpServer(
    { name: 'taller', version: '1.0.0' },
    {
      instructions:
        'Herramientas del Taller mecánico (órdenes de servicio, diagnóstico, reparación e inventario). ' +
        `Usuario: ${actor.nombre} ${actor.apellido}, rol ${actor.rol}. ` +
        'Los montos están en pesos colombianos. Antes de cancelar una orden o registrar ' +
        'partes usadas, confirme con el usuario el código y las cantidades.',
    },
  );
  const si = (nombre: string) => permitidas.has(nombre);

  if (si('consultar_ordenes'))
    servidor.registerTool(
      'consultar_ordenes',
    {
      title: 'Consultar órdenes de servicio',
      description:
        (actor.rol === 'mecanico' ? 'Consulta los carros que tiene asignados. ' : 'Consulta las órdenes del taller. ') +
        'Con un código devuelve el detalle de esa orden; sin código, la lista (filtrable por estado o por placa).',
      inputSchema: z.object({
        codigo: codigo.optional(),
        estado: z.enum(ESTADOS).optional().describe('Filtra por estado'),
        buscar: z.string().optional().describe('Placa o nombre del cliente'),
      }),
      annotations: LECTURA,
    },
    ({ codigo: cod, estado, buscar }) =>
      seguro(() => (cod ? unaOrden(actor, cod) : listarOrdenes(actor, { estado, buscar }, 30))),
  );

  if (si('consultar_diagnostico'))
    servidor.registerTool(
      'consultar_diagnostico',
    {
      title: 'Consultar diagnóstico',
      description: 'Devuelve el paso a paso del diagnóstico de una orden, los repuestos y el costo estimado.',
      inputSchema: z.object({ codigo }),
      annotations: LECTURA,
    },
    ({ codigo: cod }) => seguro(() => verDiagnostico(actor, cod)),
  );

  if (si('consultar_reparacion'))
    servidor.registerTool(
      'consultar_reparacion',
    {
      title: 'Consultar reparación y liquidación',
      description:
        'Devuelve las horas registradas, las partes usadas, las tareas hechas y la liquidación (estimado contra real).',
      inputSchema: z.object({ codigo }),
      annotations: LECTURA,
    },
    ({ codigo: cod }) => seguro(() => verReparacion(actor, cod)),
  );

  if (si('consultar_inventario'))
    servidor.registerTool(
      'consultar_inventario',
    {
      title: 'Consultar inventario',
      description: 'Busca ítems por nombre o código con su precio, cantidad y nivel de alerta.',
      inputSchema: z.object({
        texto: z.string().optional().describe('Parte del nombre o del código; por ejemplo: filtro'),
        solo_alertas: z.boolean().optional().describe('true para ver solo los ítems en alerta'),
      }),
      annotations: LECTURA,
    },
    ({ texto, solo_alertas }) => seguro(() => listarItems({ texto, soloAlertas: solo_alertas })),
  );

  if (si('registrar_diagnostico'))
    servidor.registerTool(
      'registrar_diagnostico',
    {
      title: 'Registrar diagnóstico',
      description:
        'Guarda el borrador del diagnóstico: reemplaza el paso a paso completo con sus horas, valor del servicio ' +
        'y repuestos (item_id del inventario, o descripción si no está en inventario).',
      inputSchema: z.object({
        codigo,
        observaciones: z.string().optional(),
        tareas: z
          .array(
            z.object({
              descripcion: z.string().describe('Qué hacer en este paso'),
              horas_estimadas: z.number().min(0),
              valor_servicio: z.number().min(0).optional(),
              repuestos: z
                .array(
                  z.object({
                    item_id: z.number().int().optional().describe('id según consultar_inventario'),
                    descripcion: z.string().optional().describe('Pieza que no está en inventario'),
                    cantidad: z.number().int().min(1),
                    precio_unitario: z.number().min(0).optional(),
                  }),
                )
                .optional(),
            }),
          )
          .min(1),
      }),
      annotations: ESCRIBE,
    },
    ({ codigo: cod, observaciones, tareas }) =>
      seguro(() =>
        guardarDiagnostico(
          actor,
          cod,
          validar(diagnosticoDto, {
            observaciones,
            tareas: tareas.map((t) => ({
              descripcion: t.descripcion,
              horasEstimadas: t.horas_estimadas,
              valorServicio: t.valor_servicio,
              repuestos: (t.repuestos ?? []).map((r) => ({
                itemId: r.item_id,
                descripcion: r.descripcion,
                cantidad: r.cantidad,
                precioUnitario: r.precio_unitario,
              })),
            })),
          }),
        ),
      ),
  );

  if (si('finalizar_diagnostico'))
    servidor.registerTool(
      'finalizar_diagnostico',
    {
      title: 'Finalizar diagnóstico',
      description: 'Cierra el diagnóstico y deja la orden lista para que el cliente apruebe el costo.',
      inputSchema: z.object({ codigo }),
      annotations: ESCRIBE,
    },
    ({ codigo: cod }) => seguro(() => finalizarDiagnostico(actor, cod)),
  );

  if (si('registrar_horas'))
    servidor.registerTool(
      'registrar_horas',
    {
      title: 'Registrar horas de trabajo',
      description: 'Registra el tiempo trabajado en la reparación (fechas ISO 8601 con zona horaria).',
      inputSchema: z.object({
        codigo,
        inicio: z.string().describe('Por ejemplo: 2026-10-22T08:00:00-05:00'),
        fin: z.string().describe('Por ejemplo: 2026-10-22T10:30:00-05:00'),
        tarea_id: z.number().int().optional().describe('Paso del diagnóstico en que trabajó'),
        nota: z.string().optional(),
      }),
      annotations: ESCRIBE,
    },
    ({ codigo: cod, inicio, fin, tarea_id, nota }) =>
      seguro(() => registrarHoras(actor, cod, validar(horasDto, { inicio, fin, tareaId: tarea_id, nota }))),
  );

  if (si('registrar_parte_usada'))
    servidor.registerTool(
      'registrar_parte_usada',
    {
      title: 'Registrar parte usada',
      description: 'Descuenta una parte del inventario y la suma a la reparación. Confirme cantidad antes.',
      inputSchema: z.object({ codigo, item_id: z.number().int(), cantidad: z.number().int().min(1) }),
      annotations: ESCRIBE,
    },
    ({ codigo: cod, item_id, cantidad }) => seguro(() => registrarParte(actor, cod, item_id, cantidad)),
  );

  if (si('marcar_tarea'))
    servidor.registerTool(
      'marcar_tarea',
    {
      title: 'Marcar paso como hecho',
      description: 'Marca o desmarca un paso del diagnóstico como completado en la reparación.',
      inputSchema: z.object({ codigo, tarea_id: z.number().int(), completada: z.boolean() }),
      annotations: ESCRIBE,
    },
    ({ codigo: cod, tarea_id, completada }) => seguro(() => marcarTarea(actor, cod, tarea_id, completada)),
  );

  if (si('terminar_reparacion'))
    servidor.registerTool(
      'terminar_reparacion',
    {
      title: 'Terminar reparación',
      description: 'Cierra la reparación con su liquidación y solicita la factura.',
      inputSchema: z.object({ codigo }),
      annotations: ESCRIBE,
    },
    ({ codigo: cod }) => seguro(() => terminarReparacion(actor, cod)),
  );

  if (si('panel_taller'))
    servidor.registerTool(
      'panel_taller',
    {
      title: 'Panel del taller',
      description: 'Resumen: órdenes abiertas por etapa, ítems en alerta, facturado del mes y carga de mecánicos.',
      annotations: LECTURA,
    },
    () => seguro(() => panel()),
  );

  if (si('consultar_disponibilidad'))
    servidor.registerTool(
      'consultar_disponibilidad',
    {
      title: 'Consultar disponibilidad de mecánicos',
      description: 'Lista los mecánicos con su carga actual (órdenes abiertas) para decidir a quién asignar.',
      annotations: LECTURA,
    },
    () => seguro(() => disponibilidad()),
  );

  if (si('asignar_mecanico'))
    servidor.registerTool(
      'asignar_mecanico',
    {
      title: 'Asignar mecánico',
      description: 'Asigna un mecánico a la etapa de diagnóstico o de reparación de una orden.',
      inputSchema: z.object({
        codigo,
        mecanico_id: z.string().describe('id del mecánico, según consultar_disponibilidad'),
        etapa: z.enum(ETAPAS),
      }),
      annotations: ESCRIBE,
    },
    ({ codigo: cod, mecanico_id, etapa }) => seguro(() => asignar(actor, cod, mecanico_id, etapa)),
  );

  if (si('buscar_clientes'))
    servidor.registerTool(
      'buscar_clientes',
    {
      title: 'Buscar clientes',
      description: 'Busca clientes por nombre, documento o placa, con sus vehículos.',
      inputSchema: z.object({ texto: z.string().optional() }),
      annotations: LECTURA,
    },
    ({ texto }) => seguro(() => listarClientes(texto)),
  );

  if (si('registrar_cliente'))
    servidor.registerTool(
      'registrar_cliente',
    {
      title: 'Registrar cliente',
      description: 'Registra un cliente nuevo del taller.',
      inputSchema: esquemaCliente,
      annotations: ESCRIBE,
    },
    (datos) => seguro(() => crearCliente(validar(clienteDto, datos))),
  );

  if (si('registrar_vehiculo'))
    servidor.registerTool(
      'registrar_vehiculo',
    {
      title: 'Registrar vehículo',
      description: 'Registra un vehículo a nombre de un cliente (cliente_id según buscar_clientes).',
      inputSchema: esquemaVehiculo.extend({ cliente_id: z.number().int() }),
      annotations: ESCRIBE,
    },
    ({ cliente_id, ...datos }) => seguro(() => crearVehiculo(cliente_id, validar(vehiculoDto, datos))),
  );

  if (si('crear_orden'))
    servidor.registerTool(
      'crear_orden',
    {
      title: 'Crear orden de servicio',
      description: 'Abre una orden de servicio para un vehículo ya registrado.',
      inputSchema: z.object({
        placa: z.string(),
        motivo: z.string().describe('Lo que reporta el cliente'),
        kilometraje: z.number().int().optional(),
      }),
      annotations: ESCRIBE,
    },
    (datos) => seguro(() => crearOrden(actor, validar(nuevaOrdenDto, datos))),
  );

  if (si('cambiar_estado_orden'))
    servidor.registerTool(
      'cambiar_estado_orden',
    {
      title: 'Aprobar o entregar una orden',
      description:
        'aprobado: el cliente aceptó el costo del diagnóstico. entregado: el carro reparado se le entregó al cliente.',
      inputSchema: z.object({ codigo, estado: z.enum(['aprobado', 'entregado']), nota: z.string().optional() }),
      annotations: ESCRIBE,
    },
    ({ codigo: cod, estado, nota }) => seguro(() => cambiarEstado(actor, cod, estado, nota)),
  );

  if (si('actualizar_inventario'))
    servidor.registerTool(
      'actualizar_inventario',
    {
      title: 'Actualizar inventario',
      description: 'Registra una entrada de mercancía, una salida manual o un ajuste por conteo físico.',
      inputSchema: z.object({
        item_id: z.number().int(),
        tipo: z.enum(['entrada', 'salida', 'ajuste']),
        cantidad: z.number().int().describe('En un ajuste, el conteo físico'),
        nota: z.string().optional(),
      }),
      annotations: ESCRIBE,
    },
    ({ item_id, ...datos }) => seguro(() => registrarMovimiento(item_id, validar(movimientoDto, datos), actor)),
  );

  if (si('cancelar_orden'))
    servidor.registerTool(
      'cancelar_orden',
    {
      title: 'Cancelar orden',
      description:
        'Cancela el diagnóstico o la reparación de una orden. No se puede deshacer: úsela solo si el usuario ' +
        'lo pidió de forma explícita y confirmó el código y el motivo.',
      inputSchema: z.object({ codigo, motivo: z.string().min(5) }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    ({ codigo: cod, motivo }) => seguro(() => cancelar(actor, cod, motivo)),
  );

  if (si('registrar_ingreso_vehiculo'))
    servidor.registerTool(
      'registrar_ingreso_vehiculo',
    {
      title: 'Registrar ingreso desde el concesionario',
      description:
        'El concesionario envía un carro al taller: registra o reutiliza cliente y vehículo y abre la orden.',
      inputSchema: z.object({
        referencia_externa: z.string().describe('Identificador del vehículo en el concesionario'),
        cliente: esquemaCliente,
        vehiculo: esquemaVehiculo,
        motivo: z.string(),
        kilometraje: z.number().int().optional(),
      }),
      annotations: ESCRIBE,
    },
    (datos) => seguro(() => registrarIngreso(actor, validar(ingresoDto, datos))),
  );

  if (si('estado_vehiculo'))
    servidor.registerTool(
      'estado_vehiculo',
    {
      title: 'Estado de un vehículo del concesionario',
      description: 'Devuelve las órdenes y la línea de tiempo de un carro enviado por el concesionario.',
      inputSchema: z.object({ referencia_externa: z.string() }),
      annotations: LECTURA,
    },
    ({ referencia_externa }) => seguro(() => estadoVehiculo(referencia_externa)),
  );

  return servidor;
}
