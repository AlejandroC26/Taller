import { describe, expect, it, vi } from 'vitest';
import { leerResultado } from '../conector-mcp';
import { tiendasConfiguradas } from '../contrato';
import { MENSAJE_CATALOGO, tiendasMcp, VIGENCIA_CATALOGO_MS } from './index';
import { catalogoDe, delCatalogo, unirPorCodigo } from './proveedor';
import { REPUESTOS_SIMULADOS } from './simulado/datos';
import { tiendaSimulada } from './simulado/simulado';

// Respuesta real del agente de la tienda (hablar_con_repuestos), recortada.
const fila = {
  codigo_repuesto: 'pas-del-cer',
  nombre: 'Juego de pastillas delanteras cerámicas',
  categoria: 'Frenos',
  marcas: ['Bosch', 'Brembo'],
  unidades_disponibles: 11,
  precio_desde: 144580,
};
const respuesta = (filas: unknown[] = [fila]) => ({
  conversacion_id: '20e89eb2-74bd-4912-8b4d-abec784c6de3',
  respuesta: 'Aquí está el catálogo…',
  datos: [],
  catalogo: { tienda: 'Tienda de repuestos', precio_incluye_iva: false, total: filas.length, repuestos: filas },
});

describe('configuración de las tiendas', () => {
  it('lee MCP_TIENDA_<N>_URL, _TOKEN y _NOMBRE; sin URL no hay tienda', () => {
    expect(
      tiendasConfiguradas({
        MCP_TIENDA_1_URL: ' http://10.4.16.147:3100/mcp ',
        MCP_TIENDA_1_TOKEN: 'dev-mcp-token',
        MCP_TIENDA_1_NOMBRE: 'Tienda de repuestos',
        MCP_TIENDA_3_URL: 'http://otra/mcp',
      }),
    ).toEqual([
      { nombre: 'Tienda de repuestos', url: 'http://10.4.16.147:3100/mcp', token: 'dev-mcp-token' },
      { nombre: 'Tienda 3', url: 'http://otra/mcp', token: undefined },
    ]);
    expect(tiendasConfiguradas({})).toEqual([]);
  });
});

describe('catálogo de la tienda', () => {
  it('el precio de la tienda nunca entra al taller; el código va en mayúsculas', () => {
    const r = delCatalogo('Tienda de repuestos', fila);
    expect(r).toEqual({
      codigo_repuesto: 'PAS-DEL-CER',
      nombre: 'Juego de pastillas delanteras cerámicas',
      categoria: 'Frenos',
      marcas: ['Bosch', 'Brembo'],
      unidades_disponibles: 11,
      tiendas: ['Tienda de repuestos'],
    });
    expect(r).not.toHaveProperty('precio_desde');
    expect(delCatalogo('X', { nombre: 'sin código' })).toBeNull();
  });

  it('lee el campo catalogo del agente, como objeto o como lista; sin él es null', () => {
    expect(catalogoDe(respuesta())).toEqual([fila]);
    expect(catalogoDe({ catalogo: [fila] })).toEqual([fila]);
    expect(catalogoDe({ respuesta: 'No entendí la pregunta' })).toBeNull();
    expect(catalogoDe('texto')).toBeNull();
  });

  it('usa structuredContent si la herramienta lo devuelve', () => {
    expect(leerResultado({ structuredContent: respuesta(), content: [{ type: 'text', text: 'x' }] })).toEqual(respuesta());
  });

  it('un código en varias tiendas sale una vez, con marcas y tiendas juntas y las unidades sumadas', () => {
    const a = delCatalogo('A', fila)!;
    const b = delCatalogo('B', { ...fila, marcas: ['Bosch', 'Akebono'], unidades_disponibles: 4 })!;
    expect(unirPorCodigo([[a], [b]])).toEqual([
      { ...a, marcas: ['Bosch', 'Brembo', 'Akebono'], unidades_disponibles: 15, tiendas: ['A', 'B'] },
    ]);
  });
});

describe('tiendas por MCP', () => {
  const conf = { nombre: 'Tienda de repuestos', url: 'http://10.4.16.147:3100/mcp', token: 'dev-mcp-token' };

  it('le escribe al agente (no a la herramienta) y guarda el catálogo unos minutos', async () => {
    let reloj = 1_000_000;
    const llamar = vi.fn(async () => respuesta());
    const t = tiendasMcp([conf], llamar as never, () => reloj);
    const primero = await t.catalogo();
    expect(llamar).toHaveBeenCalledWith(conf, 'Tienda de repuestos', 'hablar_con_repuestos', { mensaje: MENSAJE_CATALOGO }, expect.any(Number));
    expect(primero.repuestos.map((r) => r.codigo_repuesto)).toEqual(['PAS-DEL-CER']);
    expect(primero.sin_respuesta).toEqual([]);

    await t.catalogo();
    expect(llamar).toHaveBeenCalledTimes(1);
    await t.catalogo({ refrescar: true });
    expect(llamar).toHaveBeenCalledTimes(2);
    reloj += VIGENCIA_CATALOGO_MS + 1;
    await t.catalogo();
    expect(llamar).toHaveBeenCalledTimes(3);
  });

  it('si el agente no trae catalogo o se cae, usa el último guardado y lo avisa', async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(respuesta())
      .mockResolvedValueOnce({ respuesta: 'No pude consultar el inventario' })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const t = tiendasMcp([conf], llamar as never);
    await t.catalogo();
    const sinCatalogo = await t.catalogo({ refrescar: true });
    expect(sinCatalogo.sin_respuesta).toEqual(['Tienda de repuestos']);
    expect(sinCatalogo.repuestos).toHaveLength(1);
    const caida = await t.catalogo({ refrescar: true });
    expect(caida.sin_respuesta).toEqual(['Tienda de repuestos']);
    expect(caida.repuestos).toHaveLength(1);
  });

  it('sin catálogo guardado y sin respuesta, la lista queda vacía', async () => {
    const t = tiendasMcp([conf], vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as never);
    expect(await t.catalogo()).toEqual({ repuestos: [], sin_respuesta: ['Tienda de repuestos'], actualizado_en: null });
  });

  it('dos búsquedas al mismo tiempo comparten la misma pregunta al agente', async () => {
    const llamar = vi.fn(async () => respuesta());
    const t = tiendasMcp([conf], llamar as never);
    await Promise.all([t.catalogo(), t.catalogo()]);
    expect(llamar).toHaveBeenCalledTimes(1);
  });
});

describe('tienda simulada', () => {
  it('devuelve los 15 códigos universales sin precio', async () => {
    const c = await tiendaSimulada().catalogo();
    expect(c.repuestos).toHaveLength(REPUESTOS_SIMULADOS.length);
    expect(c.repuestos.map((r) => r.codigo_repuesto)).toContain('PAS-DEL-CER');
    expect(JSON.stringify(c)).not.toContain('precio');
  });
});
