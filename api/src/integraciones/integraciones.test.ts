import { describe, expect, it, vi } from 'vitest';
import { leerResultado, SinConexion } from './conector-mcp';
import { configuracion, CONTRATO } from './contrato';
import { intentarEnvio, MAXIMO_INTENTOS } from './despachador';
import { ingresoDto } from './concesionario';

const evento = {
  destino: 'facturacion' as const,
  herramienta: 'emitir_factura',
  datos: { orden: 'OT-0001', total: 1000 },
  intentos: 0,
};

describe('configuración de los MCP externos', () => {
  it('lee la URL y el token de MCP_<DESTINO>_URL y _TOKEN', () => {
    expect(configuracion('partes', { MCP_PARTES_URL: 'http://partes/mcp', MCP_PARTES_TOKEN: 'abc' })).toEqual({
      url: 'http://partes/mcp',
      token: 'abc',
    });
  });

  it('sin URL el destino no está configurado; el token es opcional', () => {
    expect(configuracion('facturacion', {})).toBeNull();
    expect(configuracion('concesionario', { MCP_CONCESIONARIO_URL: ' http://c/mcp ' })).toEqual({
      url: 'http://c/mcp',
      token: undefined,
    });
  });

  it('el contrato nombra las herramientas que usa el taller', () => {
    expect(Object.keys(CONTRATO.partes.herramientas)).toEqual(['buscar_parte', 'solicitar_parte']);
    expect(Object.keys(CONTRATO.facturacion.herramientas)).toEqual(['emitir_factura']);
    expect(Object.keys(CONTRATO.concesionario.herramientas)).toEqual(['notificar_estado_vehiculo']);
  });
});

describe('despacho de la bandeja de salida', () => {
  it('un envío exitoso queda enviado con la respuesta', async () => {
    const llamar = vi.fn(async () => ({ factura: 'FE-100' }));
    const cambios = await intentarEnvio(evento, llamar);
    expect(llamar).toHaveBeenCalledWith('facturacion', 'emitir_factura', evento.datos);
    expect(cambios).toMatchObject({ estado: 'enviado', intentos: 1, respuesta: '{"factura":"FE-100"}', ultimoError: null });
  });

  it('sin MCP configurado queda desactivado, sin contar intentos', async () => {
    const cambios = await intentarEnvio(evento, async () => {
      throw new SinConexion('El MCP de facturacion no está configurado');
    });
    expect(cambios).toEqual({ estado: 'desactivado', ultimoError: 'El MCP de facturacion no está configurado' });
  });

  it('un fallo se reintenta hasta el máximo y luego queda fallido', async () => {
    const falla = async () => {
      throw new Error('timeout');
    };
    expect(await intentarEnvio(evento, falla)).toMatchObject({ estado: 'pendiente', intentos: 1, ultimoError: 'timeout' });
    expect(await intentarEnvio({ ...evento, intentos: MAXIMO_INTENTOS - 1 }, falla)).toMatchObject({
      estado: 'fallido',
      intentos: MAXIMO_INTENTOS,
    });
  });
});

describe('resultado de una herramienta externa', () => {
  it('lee JSON o texto', () => {
    expect(leerResultado({ content: [{ type: 'text', text: '{"ok":true}' }] })).toEqual({ ok: true });
    expect(leerResultado({ content: [{ type: 'text', text: 'recibido' }] })).toBe('recibido');
  });

  it('un resultado con isError se convierte en excepción', () => {
    expect(() => leerResultado({ isError: true, content: [{ type: 'text', text: 'sin cupo' }] })).toThrow('sin cupo');
  });
});

describe('ingreso desde el concesionario', () => {
  const ingreso = {
    referencia_externa: 'CON-2026-0042',
    cliente: { nombre: 'Laura', apellido: 'Mejía', documento: '1030405060', telefono: '3015556677' },
    vehiculo: { placa: 'xyz-987', marca: 'Renault', modelo: 'Duster', anio: 2025 },
    motivo: 'Revisión de alistamiento',
  };

  it('valida y normaliza cliente y vehículo', () => {
    const r = ingresoDto.parse(ingreso);
    expect(r.vehiculo.placa).toBe('XYZ987');
    expect(r.vehiculo.kilometraje).toBe(0);
  });

  it('exige la referencia del concesionario', () => {
    expect(ingresoDto.safeParse({ ...ingreso, referencia_externa: '' }).success).toBe(false);
  });
});
