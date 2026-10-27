import { describe, expect, it } from 'vitest';
import { totalManoObra } from './costos';
import { aEntradaLocal, cuenta, dictamenSugerido, NOMBRE_ESTADO, nombreRol, pesos, tonoDe } from './formato';
import { enlacesDe, inicioDe, puede, ROLES } from './permisos';

describe('formato', () => {
  it('muestra pesos colombianos sin centavos', () => {
    expect(pesos(120000).replace(/\s/g, ' ')).toMatch(/\$ ?120\.000/);
    expect(pesos(null)).toMatch(/0/);
  });

  it('el tono del estado: azul trabajando, violeta esperando a otro sistema, menta hecho', () => {
    expect(tonoDe('en_diagnostico')).toBe('progreso');
    expect(tonoDe('en_reparacion')).toBe('progreso');
    expect(tonoDe('validando_garantia')).toBe('revision');
    expect(tonoDe('en_cotizacion')).toBe('revision');
    expect(tonoDe('pendiente_facturacion')).toBe('revision');
    expect(tonoDe('aprobada')).toBe('aprobado');
    expect(tonoDe('facturada')).toBe('listo');
    expect(tonoDe('entregada')).toBe('listo');
    expect(tonoDe('rechazada')).toBe('alerta');
    expect(tonoDe('agendada')).toBe('neutro');
    expect(tonoDe('cancelada')).toBe('neutro');
  });

  it('nombra los 12 estados en español', () => {
    expect(Object.keys(NOMBRE_ESTADO)).toHaveLength(12);
    expect(NOMBRE_ESTADO.validando_garantia).toMatch(/garantía/i);
    expect(NOMBRE_ESTADO.en_reparacion).toBe('En reparación');
  });

  it('cuenta en singular o plural', () => {
    expect(cuenta(1, 'paso', 'pasos')).toBe('1 paso');
    expect(cuenta(0, 'paso', 'pasos')).toBe('0 pasos');
  });

  it('nombra los roles con tilde y deja intacto uno desconocido', () => {
    expect(nombreRol('mecanico')).toBe('Mecánico');
    expect(nombreRol('agente')).toMatch(/Agente/);
    expect(nombreRol('otro')).toBe('otro');
  });

  it('el dictamen sugerido sale de la causa (igual que la API)', () => {
    expect(dictamenSugerido('defecto_fabrica')).toBe(true);
    expect(dictamenSugerido('repuesto_defectuoso')).toBe(true);
    expect(dictamenSugerido('mala_instalacion_taller')).toBe(true);
    expect(dictamenSugerido('manipulacion_cliente')).toBe(false);
    expect(dictamenSugerido('desgaste_normal')).toBe(false);
    expect(dictamenSugerido(null)).toBe(false);
  });

  it('convierte una fecha al formato de datetime-local', () => {
    expect(aEntradaLocal(new Date(2026, 9, 22, 8, 5))).toBe('2026-10-22T08:05');
  });
});

describe('permisos en la interfaz', () => {
  it('los roles son fijos', () => {
    expect([...ROLES]).toEqual(['administrador', 'mecanico', 'agente']);
  });

  it('el mecánico y el administrador usan el tablero; el agente va al MCP', () => {
    expect(inicioDe('mecanico')).toBe('/mis-trabajos');
    expect(inicioDe('administrador')).toBe('/mis-trabajos');
    expect(inicioDe('agente')).toBe('/sin-acceso');
  });

  it('el mecánico ve solo sus trabajos; el administrador, órdenes y usuarios', () => {
    expect(enlacesDe('mecanico').map((e) => e.a)).toEqual(['/mis-trabajos']);
    expect(enlacesDe('administrador').map((e) => e.texto)).toEqual(['Órdenes', 'Usuarios']);
    expect(enlacesDe('agente')).toEqual([]);
  });

  it('trabajar: el mecánico asignado a la etapa o el administrador', () => {
    expect(puede.trabajar('mecanico', true)).toBe(true);
    expect(puede.trabajar('mecanico', false)).toBe(false);
    expect(puede.trabajar('administrador', false)).toBe(true);
    expect(puede.trabajar('agente', true)).toBe(false);
  });

  it('solo el mecánico toma órdenes de la cola de su sede', () => {
    expect(puede.tomar('mecanico')).toBe(true);
    expect(puede.tomar('administrador')).toBe(false);
  });
});

describe('mano de obra (igual que la API)', () => {
  it('suma el precio fijo de cada SKU', () => {
    expect(totalManoObra([{ precio: 60000 }, { precio: 180000 }, { precio: 45000.5 }])).toBe(285000.5);
  });

  it('los precios vacíos o inválidos cuentan como 0', () => {
    expect(totalManoObra([{ precio: NaN }, { precio: 90000 }])).toBe(90000);
    expect(totalManoObra([])).toBe(0);
  });
});
