import { describe, expect, it, vi } from 'vitest';
import { leerResultado, SinConexion } from './conector-mcp';
import { configuracion, CONTRATO } from './contrato';
import { intentarEnvio, MAXIMO_INTENTOS, TIEMPO_ENVIO_MS } from './despachador';

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
