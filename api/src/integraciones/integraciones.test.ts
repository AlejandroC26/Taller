import { describe, expect, it, vi } from 'vitest';
import { leerResultado, SinConexion } from './conector-mcp';
import { configuracion, CONTRATO } from './contrato';
import { intentarEnvio, MAXIMO_INTENTOS } from './despachador';

const evento = { destino: 'facturacion' as const, herramienta: 'crear_cotizacion', datos: { codigo: 'OT-0001' }, intentos: 0 };

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
