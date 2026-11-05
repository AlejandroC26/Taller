import { describe, expect, it, vi } from 'vitest';
import { leerResultado, SinConexion } from './conector-mcp';
import { avisoEstado, configuracion, CONTRATO, solicitudGarantia } from './contrato';
import { intentarEnvio, MAXIMO_INTENTOS, rechazoDelServidor, TIEMPO_ENVIO_MS } from './despachador';

const evento = { id: 42, destino: 'facturacion' as const, herramienta: 'crear_cotizacion', datos: { codigo: 'OT-0001' }, intentos: 0 };

describe('contrato con los otros agentes', () => {
  it('lee URL y token de MCP_<DESTINO>_URL y _TOKEN', () => {
    expect(configuracion('facturacion', { MCP_FACTURACION_URL: ' http://f/mcp ', MCP_FACTURACION_TOKEN: 'abc' })).toEqual({ url: 'http://f/mcp', token: 'abc' });
    expect(configuracion('concesionario', {})).toBeNull();
  });

  it('nombra lo que el taller llama en cada agente', () => {
    expect(Object.keys(CONTRATO.concesionario.herramientas)).toEqual(['consultar_relacion', 'decodificar_vin', 'validar_garantia', 'notificar_estado_vehiculo']);
    expect(Object.keys(CONTRATO.facturacion.herramientas)).toEqual(['crear_cotizacion', 'notificar_reparacion_terminada']);
  });
});

describe('bandeja de salida', () => {
  it('un envío exitoso queda enviado con la respuesta como texto', async () => {
    const cambios = await intentarEnvio(evento, vi.fn(async () => ({ ref: 'COT-9' })));
    expect(cambios).toMatchObject({ estado: 'enviado', intentos: 1, respuesta: '{"ref":"COT-9"}' });
  });

  it('cada intento lleva el mismo id_mensaje del evento y espera hasta 90 s (facturación tarda en el acuse)', async () => {
    const llamar = vi.fn(async (_d: string, _h: string, _datos: Record<string, unknown>, _ms?: number) => ({ recibido: true }));
    await intentarEnvio(evento, llamar);
    await intentarEnvio({ ...evento, intentos: 1 }, llamar);
    const ids = llamar.mock.calls.map((c) => c[2].id_mensaje);
    expect(ids).toEqual(['taller-42-crear_cotizacion', 'taller-42-crear_cotizacion']);
    expect(llamar).toHaveBeenCalledWith('facturacion', 'crear_cotizacion', { codigo: 'OT-0001', id_mensaje: 'taller-42-crear_cotizacion' }, TIEMPO_ENVIO_MS);
    expect(TIEMPO_ENVIO_MS).toBeGreaterThanOrEqual(60_000);
  });

  it('sin MCP configurado queda desactivado; un fallo se reintenta hasta el máximo', async () => {
    expect(await intentarEnvio(evento, async () => { throw new SinConexion('sin URL'); })).toEqual({ estado: 'desactivado', ultimoError: 'sin URL' });
    const falla = async () => { throw new Error('timeout'); };
    expect(await intentarEnvio(evento, falla)).toMatchObject({ estado: 'pendiente', intentos: 1 });
    expect(await intentarEnvio({ ...evento, intentos: MAXIMO_INTENTOS - 1 }, falla)).toMatchObject({ estado: 'fallido' });
  });

  it('lee JSON o texto de otra herramienta y convierte isError en excepción', () => {
    expect(leerResultado({ content: [{ type: 'text', text: '{"ok":true}' }] })).toEqual({ ok: true });
    expect(() => leerResultado({ isError: true, content: [{ type: 'text', text: 'sin cupo' }] })).toThrow('sin cupo');
  });
});

describe('mensajes con los límites del MCP del concesionario', () => {
  const evento = { id: 9, destino: 'concesionario' as const, herramienta: 'validar_garantia', datos: {}, intentos: 0 };

  it('notificar_estado_vehiculo: sede por código, nota de hasta 300 y fecha en hora de Colombia', () => {
    const base = { codigo: 'OT-0084', idRelacion: 'REL-1005', placa: 'MGL630', sede: 'PL-FRENOS', estado: 'en_diagnostico' };
    expect(avisoEstado({ ...base, nota: 'Un mecánico tomó la orden' }, new Date('2026-11-05T19:05:00Z'))).toEqual({
      codigo: 'OT-0084',
      id_relacion: 'REL-1005',
      placa: 'MGL630',
      sede: 'PL-FRENOS',
      estado: 'en_diagnostico',
      nota: 'Un mecánico tomó la orden',
      fecha: '2026-11-05T14:05:00-05:00',
    });
    expect(avisoEstado({ ...base, nota: null })).not.toHaveProperty('nota');
    expect(avisoEstado({ ...base, nota: 'x'.repeat(400) }).nota).toHaveLength(300);
  });

  it('validar_garantia: sin nulos, motivo de hasta 300 y hasta 20 evidencias', () => {
    const s = solicitudGarantia({
      codigo: 'OT-0021',
      idRelacion: 'REL-1001',
      vin: '9FBHJD204PM100001',
      porGarantia: false,
      motivoReclamo: null,
      servicios: [{ tareaId: 1, sku: 'FRE-DISCOS', especialidad: 'frenos', causa: null, aplica: false, motivo: null, evidencias: Array(25).fill('http://x/e.jpg') }],
    });
    expect(s).not.toHaveProperty('motivo_reclamo');
    expect(s.servicios[0]).toEqual({ tarea_id: 1, sku: 'FRE-DISCOS', especialidad: 'frenos', aplica: false, evidencias: Array(20).fill('http://x/e.jpg') });
    const largo = solicitudGarantia({ ...{ codigo: 'OT-1', idRelacion: 'REL-1001', vin: 'V', porGarantia: true, servicios: [] }, motivoReclamo: 'y'.repeat(500) });
    expect(largo.motivo_reclamo).toHaveLength(300);
  });

  it('reconoce los rechazos que no se arreglan reintentando', () => {
    expect(rechazoDelServidor('Streamable HTTP error: Error POSTing to endpoint (HTTP 401): {"message":"Credenciales no válidas"}')).toBe('credenciales');
    expect(rechazoDelServidor('Version negotiation failed: the server denied access (HTTP 403)')).toBe('credenciales');
    expect(rechazoDelServidor('Error POSTing to endpoint (HTTP 429): Too Many Requests')).toBe('limite');
    expect(rechazoDelServidor('El MCP de concesionario no respondió en 90 s')).toBeNull();
    expect(rechazoDelServidor(null)).toBeNull();
  });

  it('con las credenciales rechazadas queda fallido al primer intento, para no bloquear la IP', async () => {
    const cambios = await intentarEnvio(evento, async () => {
      throw new Error('Error POSTing to endpoint (HTTP 401): Credenciales no válidas');
    });
    expect(cambios).toMatchObject({ estado: 'fallido', intentos: 1, ultimoError: expect.stringContaining('MCP_CONCESIONARIO_TOKEN') });
  });
});
