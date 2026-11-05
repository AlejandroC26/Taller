import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conflicto, noDisponible } from '../comun/errores';
import { actorDe } from '../comun/pruebas';
import * as diagnosticos from '../diagnosticos/diagnosticos.service';
import * as garantias from '../garantias/garantias.service';
import * as idempotencia from '../integraciones/idempotencia';
import * as ordenes from '../ordenes/ordenes.service';
import { PASOS } from '../ordenes/reglas';
import * as talleres from '../talleres/talleres.service';
import { crearServidorMcp, HERRAMIENTAS_MECANICO } from './herramientas';

const SEDE = { id: 2, codigo: 'PL-FRENOS', nombre: 'Pulgas Locas Frenos y Suspensión', ubicacion: { ciudad: 'Bogotá', direccion: 'Calle 1' } };
const orden = { codigo: 'OT-0001', estado: 'agendada', siguiente_paso: { responsable: 'mecanico', descripcion: 'x' }, acciones_disponibles: ['tomar_orden'] };

vi.mock('../ordenes/ordenes.service', async (original) => ({
  ...(await original<typeof import('../ordenes/ordenes.service')>()),
  unaOrden: vi.fn(async () => orden),
  agendarCita: vi.fn(async () => ({ ...orden, sede: SEDE, fecha_cita: '2026-11-03T08:00:00-05:00', por_garantia: false, motivo_reclamo: null })),
  consultarPrediagnostico: vi.fn(async () => ({
    id_prediagnostico: 'PD-0001',
    id_relacion: 'REL-1001',
    vehiculo: 'Renault Duster 2023',
    taller: { ...SEDE, horario: { dias: [1, 2, 3, 4, 5, 6], apertura: '08:00', cierre: '17:00' } },
    especialidad: 'frenos',
    ruta: 'especializada',
    confianza: 0.8,
    resumen: 'Pastillas gastadas',
    fuente: 'reglas',
    motivo_decision: 'Lo que cuenta el cliente apunta a frenos. Por eso va directo a Pulgas Locas Frenos y Suspensión, la sede especialista.',
    servicios_probables: [{ sku: 'FRE-PASTILLAS', nombre: 'Cambio de pastillas de freno', precio_mano_obra: 80000 }],
    garantia: { vigente: true, vence: '2028-03-14', kmMaximo: 60000, cubre: ['frenos'], aplica_probable: false, causa_probable: 'desgaste_normal' },
    por_garantia: false,
    motivo_reclamo: null,
    sede_sugerida: SEDE,
    siguiente_paso: { responsable: 'concesionario', descripcion: 'Agende la cita' },
    acciones_disponibles: ['consultar_disponibilidad', 'agendar_cita'],
  })),
  listarOrdenes: vi.fn(async () => [orden]),
  tomarOrden: vi.fn(async () => ({ ...orden, estado: 'en_diagnostico' })),
}));
vi.mock('../diagnosticos/diagnosticos.service', async (original) => ({
  ...(await original<typeof import('../diagnosticos/diagnosticos.service')>()),
  guardarDiagnostico: vi.fn(async () => ({ orden: 'OT-0001', servicios: [] })),
  buscarRepuestosParaOrden: vi.fn(async () => ({
    orden: 'OT-0001',
    tiendas: ['Tienda de repuestos'],
    sin_respuesta: [],
    actualizado_en: '2026-10-31T19:00:00.000Z',
    categorias: ['Frenos'],
    repuestos: [{ codigo_repuesto: 'PAS-DEL-CER', nombre: 'Juego de pastillas delanteras cerámicas', categoria: 'Frenos', marcas: ['Bosch', 'Brembo'], unidades_disponibles: 11, tiendas: ['Tienda de repuestos'] }],
  })),
}));
vi.mock('../garantias/garantias.service', async (original) => ({
  ...(await original<typeof import('../garantias/garantias.service')>()),
  registrarResultadoGarantia: vi.fn(async () => ({ ...orden, estado: 'en_cotizacion' })),
}));
const SEDE_HORARIO = { ...SEDE, horario: { dias: [1, 2, 3, 4, 5, 6], apertura: '08:00', cierre: '17:00' } };
vi.mock('../talleres/talleres.service', async (original) => ({
  ...(await original<typeof import('../talleres/talleres.service')>()),
  listarTalleres: vi.fn(async () => [{ id: 1, codigo: 'PL-CENTRO' }]),
  disponibilidad: vi.fn(async () => ({ taller: SEDE_HORARIO, fecha: '2026-11-05', cupo_por_franja: 1, franjas: [{ inicio: '2026-11-05T08:00:00-05:00', libres: 0 }] })),
  disponibilidadRango: vi.fn(async () => ({
    taller: SEDE_HORARIO,
    desde: '2026-11-05',
    hasta: '2026-11-12',
    cupo_por_franja: 1,
    franjas: [{ inicio: '2026-11-05T09:00:00-05:00', libres: 1 }],
    total: 1,
    siguiente_paso: { responsable: 'concesionario', descripcion: 'x' },
    acciones_disponibles: ['reservar_franja', 'agendar_cita'],
  })),
  reservarFranja: vi.fn(async () => ({
    id_reserva: 'RS-0001',
    id_relacion: 'REL-1005',
    taller: SEDE_HORARIO,
    fecha_hora: '2026-11-05T09:00:00-05:00',
    vence_en: '2026-11-04T10:10:00-05:00',
    minutos_vigencia: 10,
    siguiente_paso: { responsable: 'concesionario', descripcion: 'x' },
    acciones_disponibles: ['agendar_cita'],
  })),
}));
vi.mock('../servicios/servicios.service', async (original) => ({
  ...(await original<typeof import('../servicios/servicios.service')>()),
  listarServicios: vi.fn(async () => [{ sku: 'REV-GENERAL' }]),
}));
// La idempotencia real usa la base: aquí se simula en memoria.
const vistos = new Map<string, unknown>();
vi.mock('../integraciones/idempotencia', () => ({
  unaVez: vi.fn(async (id: string | undefined, _h: string, accion: () => Promise<unknown>) => {
    if (id && vistos.has(id)) return vistos.get(id);
    const r = await accion();
    if (id) vistos.set(id, r);
    return r;
  }),
}));

async function conectar(rol: string) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await crearServidorMcp(actorDe(rol)).connect(a);
  const cliente = new Client({ name: 'prueba', version: '1.0.0' });
  await cliente.connect(b);
  return cliente;
}
const texto = (r: { content?: unknown }) => (r.content as { text: string }[])[0].text;

describe('MCP para agentes y orquestadores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vistos.clear();
  });

  it('el agente ve todas las herramientas; el mecánico solo las suyas; otro rol, ninguna', async () => {
    const agente = (await (await conectar('agente')).listTools()).tools.map((t) => t.name);
    const admin = (await (await conectar('administrador')).listTools()).tools.map((t) => t.name);
    const mecanico = (await (await conectar('mecanico')).listTools()).tools.map((t) => t.name);
    expect(agente.length).toBeGreaterThan(30);
    expect(admin.sort()).toEqual([...agente].sort());
    expect(mecanico.sort()).toEqual([...HERRAMIENTAS_MECANICO].sort());
    expect(mecanico).not.toContain('agendar_cita');
    expect(mecanico).not.toContain('registrar_pago');
    expect((await (await conectar('visitante')).listTools()).tools).toEqual([]);
  });

  it('toda acción que el flujo sugiere existe como herramienta', async () => {
    const nombres = new Set((await (await conectar('agente')).listTools()).tools.map((t) => t.name));
    for (const paso of Object.values(PASOS)) for (const accion of paso.acciones) expect(nombres.has(accion), accion).toBe(true);
  });

  it('las herramientas tienen outputSchema y las que cambian algo aceptan id_mensaje', async () => {
    const { tools } = await (await conectar('agente')).listTools();
    for (const t of tools) expect(t.outputSchema, t.name).toBeDefined();
    for (const nombre of ['agendar_cita', 'registrar_resultado_garantia', 'registrar_respuesta_cliente', 'registrar_pago', 'tomar_orden']) {
      expect(Object.keys(tools.find((t) => t.name === nombre)!.inputSchema.properties ?? {})).toContain('id_mensaje');
    }
    expect(tools.find((t) => t.name === 'cancelar_cita')?.annotations?.destructiveHint).toBe(true);
  });

  it('se presenta y publica sus recursos para que el agente entienda el sistema', async () => {
    const cliente = await conectar('agente');
    expect(cliente.getInstructions()).toContain('Taller Pulgas Locas');
    expect(cliente.getInstructions()).toContain('siguiente_paso');
    const { resources } = await cliente.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual(['taller://contrato', 'taller://flujo', 'taller://servicios', 'taller://talleres']);
    const flujo = await cliente.readResource({ uri: 'taller://flujo' });
    expect((flujo.contents[0] as { text: string }).text).toContain('| validando_garantia | concesionario |');
  });

  it('estado_orden devuelve structuredContent con siguiente_paso y acciones', async () => {
    const r = await (await conectar('agente')).callTool({ name: 'estado_orden', arguments: { codigo: 'OT-0001' } });
    expect(r.structuredContent).toMatchObject({ codigo: 'OT-0001', acciones_disponibles: ['tomar_orden'] });
  });

  it('describir_flujo explica estados, garantía y contrato', async () => {
    const r = await (await conectar('agente')).callTool({ name: 'describir_flujo', arguments: {} });
    const datos = r.structuredContent as { estados: { estado: string }[]; garantia: unknown[]; lo_que_el_taller_envia: object };
    expect(datos.estados).toHaveLength(12);
    expect(datos.garantia).toHaveLength(5);
    expect(Object.keys(datos.lo_que_el_taller_envia)).toEqual(['concesionario', 'facturacion']);
  });

  it('agendar_cita traduce los nombres del agente al DTO de la API', async () => {
    await (await conectar('agente')).callTool({
      name: 'agendar_cita',
      arguments: { id_relacion: 'REL-1001', fecha_hora: '2026-10-27T09:00:00-05:00', mensajes_cliente: ['chilla al frenar'], por_garantia: true },
    });
    expect(ordenes.agendarCita).toHaveBeenCalledWith(
      expect.objectContaining({ rol: 'agente' }),
      expect.objectContaining({ idRelacion: 'REL-1001', mensajesCliente: ['chilla al frenar'], porGarantia: true }),
    );
  });

  it('prediagnosticar y agendar_cita publican su outputSchema completo y lo cumplen', async () => {
    const cliente = await conectar('agente');
    const { tools } = await cliente.listTools();
    const esquema = (nombre: string) => tools.find((t) => t.name === nombre)?.outputSchema as { properties: Record<string, unknown>; required: string[] };
    expect(esquema('prediagnosticar').required).toEqual(
      expect.arrayContaining(['especialidad', 'ruta', 'resumen', 'servicios_probables', 'garantia', 'sede_sugerida']),
    );
    expect(esquema('agendar_cita').required).toEqual(expect.arrayContaining(['codigo', 'estado', 'sede', 'fecha_cita', 'siguiente_paso']));

    const pre = await cliente.callTool({ name: 'prediagnosticar', arguments: { id_relacion: 'REL-1001', mensajes_cliente: ['chilla al frenar'] } });
    expect(pre.isError).toBeFalsy();
    expect(pre.structuredContent).toMatchObject({ ruta: 'especializada', sede_sugerida: { ubicacion: { ciudad: 'Bogotá' } } });
    const cita = await cliente.callTool({ name: 'agendar_cita', arguments: { id_relacion: 'REL-1001', fecha_hora: '2026-11-03T08:00:00-05:00' } });
    expect(cita.isError).toBeFalsy();
    expect(cita.structuredContent).toMatchObject({ sede: { codigo: 'PL-FRENOS' }, fecha_cita: '2026-11-03T08:00:00-05:00' });
  });

  it('enrutar_garantia decide la sede del reclamo, con id_prediagnostico y motivo_decision', async () => {
    const cliente = await conectar('agente');
    const { tools } = await cliente.listTools();
    const esquema = tools.find((t) => t.name === 'enrutar_garantia')!;
    expect(esquema.inputSchema.required).toEqual(expect.arrayContaining(['id_relacion', 'motivo_reclamo']));
    expect(esquema.outputSchema?.required).toEqual(expect.arrayContaining(['id_prediagnostico', 'taller', 'motivo_decision', 'garantia', 'siguiente_paso']));

    const r = await cliente.callTool({
      name: 'enrutar_garantia',
      arguments: {
        id_relacion: 'REL-1005',
        vin: '9FBHJD204LM500005',
        por_garantia: true,
        motivo_reclamo: 'Los frenos chillan mucho desde hace una semana',
        mensajes_cliente: ['Vengo a cobrar la garantía porque los frenos chillan mucho'],
        kilometraje: 98000,
        id_mensaje: 'conc-1-enrutar',
      },
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ id_prediagnostico: 'PD-0001', taller: { codigo: 'PL-FRENOS' } });
    expect(ordenes.consultarPrediagnostico).toHaveBeenCalledWith({
      idRelacion: 'REL-1005',
      vin: '9FBHJD204LM500005',
      porGarantia: true,
      motivoReclamo: 'Los frenos chillan mucho desde hace una semana',
      mensajesCliente: ['Vengo a cobrar la garantía porque los frenos chillan mucho'],
      kilometraje: 98000,
    });
    // Un reintento con el mismo id_mensaje no vuelve a llamar al modelo.
    await cliente.callTool({ name: 'enrutar_garantia', arguments: { id_relacion: 'REL-1005', motivo_reclamo: 'x', id_mensaje: 'conc-1-enrutar' } });
    expect(ordenes.consultarPrediagnostico).toHaveBeenCalledTimes(1);
  });

  it('enrutar_garantia sin motivo_reclamo es un error de entrada', async () => {
    const r = await (await conectar('agente')).callTool({ name: 'enrutar_garantia', arguments: { id_relacion: 'REL-1005' } });
    expect(r.isError).toBe(true);
    expect(ordenes.consultarPrediagnostico).not.toHaveBeenCalled();
  });

  it('consultar_disponibilidad con desde y hasta usa el rango; con fecha, un día; sin ninguna, error', async () => {
    const cliente = await conectar('agente');
    const rango = await cliente.callTool({ name: 'consultar_disponibilidad', arguments: { taller: 'PL-FRENOS', desde: '2026-11-05', hasta: '2026-11-12' } });
    expect(rango.isError).toBeFalsy();
    expect(rango.structuredContent).toMatchObject({ franjas: [{ inicio: '2026-11-05T09:00:00-05:00', libres: 1 }] });
    expect(talleres.disponibilidadRango).toHaveBeenCalledWith('PL-FRENOS', '2026-11-05', '2026-11-12');

    await cliente.callTool({ name: 'consultar_disponibilidad', arguments: { taller: 'PL-FRENOS', desde: '2026-11-05' } });
    expect(talleres.disponibilidadRango).toHaveBeenLastCalledWith('PL-FRENOS', '2026-11-05', '2026-11-11');

    const dia = await cliente.callTool({ name: 'consultar_disponibilidad', arguments: { taller: 'PL-FRENOS', fecha: '2026-11-05' } });
    expect(dia.isError).toBeFalsy();
    expect(talleres.disponibilidad).toHaveBeenCalledWith('PL-FRENOS', '2026-11-05');

    const sinFecha = await cliente.callTool({ name: 'consultar_disponibilidad', arguments: { taller: 'PL-FRENOS' } });
    expect(sinFecha.isError).toBe(true);
    expect(texto(sinFecha)).toContain('desde y hasta');
  });

  it('reservar_franja aparta la hora y es idempotente por id_mensaje', async () => {
    const cliente = await conectar('agente');
    const args = { taller: 'PL-FRENOS', fecha_hora: '2026-11-05T09:00:00-05:00', id_relacion: 'REL-1005', id_mensaje: 'conc-1-reservar' };
    const r = await cliente.callTool({ name: 'reservar_franja', arguments: args });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ id_reserva: 'RS-0001', minutos_vigencia: 10 });
    expect(talleres.reservarFranja).toHaveBeenCalledWith({ taller: 'PL-FRENOS', fechaHora: '2026-11-05T09:00:00-05:00', idRelacion: 'REL-1005' });
    await cliente.callTool({ name: 'reservar_franja', arguments: args });
    expect(talleres.reservarFranja).toHaveBeenCalledTimes(1);
  });

  it('agendar_cita acepta id_prediagnostico e id_reserva sin fecha_hora', async () => {
    const r = await (await conectar('agente')).callTool({
      name: 'agendar_cita',
      arguments: { id_relacion: 'REL-1005', id_prediagnostico: 'PD-0001', id_reserva: 'RS-0001', id_mensaje: 'conc-1-agendar' },
    });
    expect(r.isError).toBeFalsy();
    expect(ordenes.agendarCita).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idRelacion: 'REL-1005', idPrediagnostico: 'PD-0001', idReserva: 'RS-0001', fechaHora: undefined }),
    );
  });

  it('listar_ordenes no les envía a los agentes los datos personales del cliente', async () => {
    vi.mocked(ordenes.listarOrdenes).mockResolvedValueOnce([
      { ...orden, cliente: { cedula: '123', nombre: 'Laura', telefono: '300' } } as unknown as Awaited<ReturnType<typeof ordenes.listarOrdenes>>[number],
    ]);
    const r = await (await conectar('agente')).callTool({ name: 'listar_ordenes', arguments: { id_relacion: 'REL-1001' } });
    const { elementos } = r.structuredContent as { elementos: Record<string, unknown>[] };
    expect(elementos[0]).toMatchObject({ codigo: 'OT-0001' });
    expect(elementos[0]).not.toHaveProperty('cliente');
  });

  it('agendar_cita sin fecha_hora ni id_reserva es un error de entrada', async () => {
    const r = await (await conectar('agente')).callTool({ name: 'agendar_cita', arguments: { id_relacion: 'REL-1005', id_prediagnostico: 'PD-0001' } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toContain('fecha_hora o id_reserva');
    expect(ordenes.agendarCita).not.toHaveBeenCalled();
  });

  it('un prediagnóstico que no alcanza vuelve como isError con el mensaje en español', async () => {
    vi.mocked(ordenes.consultarPrediagnostico).mockRejectedValueOnce(
      noDisponible('No se pudo calcular el prediagnóstico a tiempo, intente de nuevo'),
    );
    const r = await (await conectar('agente')).callTool({ name: 'prediagnosticar', arguments: { id_relacion: 'REL-1001', mensajes_cliente: ['x'] } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toContain('intente de nuevo');
  });

  it('con el mismo id_mensaje no repite el cambio', async () => {
    const cliente = await conectar('agente');
    const args = { codigo: 'OT-0001', mecanico_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', id_mensaje: 'msg-1' };
    await cliente.callTool({ name: 'tomar_orden', arguments: args });
    const segunda = await cliente.callTool({ name: 'tomar_orden', arguments: args });
    expect(ordenes.tomarOrden).toHaveBeenCalledTimes(1);
    expect(segunda.structuredContent).toMatchObject({ estado: 'en_diagnostico' });
    expect(idempotencia.unaVez).toHaveBeenCalledTimes(2);
  });

  it('registrar_resultado_garantia pasa la respuesta del concesionario por servicio', async () => {
    await (await conectar('agente')).callTool({
      name: 'registrar_resultado_garantia',
      arguments: { codigo: 'OT-0001', resultados: [{ tarea_id: 4, valida: false, motivo: 'Manipulación del cliente' }], id_mensaje: 'g-1' },
    });
    expect(garantias.registrarResultadoGarantia).toHaveBeenCalledWith(expect.anything(), 'OT-0001', [{ tareaId: 4, valida: false, motivo: 'Manipulación del cliente' }], 'g-1');
  });

  it('registrar_diagnostico manda causa, dictamen y repuestos sin precio', async () => {
    await (await conectar('mecanico')).callTool({
      name: 'registrar_diagnostico',
      arguments: {
        codigo: 'OT-0001',
        servicios: [{ sku: 'fre-pastillas', causa: 'defecto_fabrica', garantia_motivo: 'Cristalizadas', repuestos: [{ codigo_repuesto: 'pas-del-cer', cantidad: 1 }] }],
      },
    });
    expect(diagnosticos.guardarDiagnostico).toHaveBeenCalledWith(expect.anything(), 'OT-0001', {
      observaciones: '',
      tareas: [
        expect.objectContaining({
          sku: 'FRE-PASTILLAS',
          causa: 'defecto_fabrica',
          garantiaMotivo: 'Cristalizadas',
          repuestos: [{ codigoRepuesto: 'PAS-DEL-CER', cantidad: 1 }],
        }),
      ],
    });
  });

  it('buscar_repuestos_tienda devuelve el catálogo por código universal, sin precio', async () => {
    const r = await (await conectar('mecanico')).callTool({ name: 'buscar_repuestos_tienda', arguments: { codigo: 'OT-0001', texto: 'pastillas', categoria: 'Frenos' } });
    expect(r.isError).toBeFalsy();
    expect(diagnosticos.buscarRepuestosParaOrden).toHaveBeenCalledWith(expect.anything(), 'OT-0001', { texto: 'pastillas', categoria: 'Frenos', refrescar: undefined });
    expect(r.structuredContent).toMatchObject({ categorias: ['Frenos'], repuestos: [{ codigo_repuesto: 'PAS-DEL-CER', marcas: ['Bosch', 'Brembo'] }] });
    expect(JSON.stringify(r.structuredContent)).not.toContain('precio');
  });

  it('un error de negocio vuelve con isError y el mensaje para corregir', async () => {
    vi.mocked(ordenes.tomarOrden).mockRejectedValueOnce(conflicto('La orden OT-0001 está en_cotizacion: no hay nada que tomar'));
    const r = await (await conectar('mecanico')).callTool({ name: 'tomar_orden', arguments: { codigo: 'OT-0001' } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toContain('no hay nada que tomar');
  });

  it('datos inválidos no llegan al service', async () => {
    const r = await (await conectar('agente')).callTool({ name: 'agendar_cita', arguments: { id_relacion: 'REL-1001', fecha_hora: 'mañana' } });
    expect(r.isError).toBe(true);
    expect(ordenes.agendarCita).not.toHaveBeenCalled();
  });
});
