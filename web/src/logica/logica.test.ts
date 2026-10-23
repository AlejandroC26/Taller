import { describe, expect, it } from 'vitest';
import { costoEstimado } from './costos';
import { aEntradaLocal, NOMBRE_ESTADO, pesos, tonoDe } from './formato';
import { enlacesDe, inicioDe, puede } from './permisos';

describe('formato', () => {
  it('muestra pesos colombianos sin centavos', () => {
    expect(pesos(120000).replace(/\s/g, ' ')).toMatch(/\$ ?120\.000/);
    expect(pesos(null)).toMatch(/0/);
  });

  it('el tono del estado: naranja en curso, verde listo, neutro el resto', () => {
    expect(tonoDe('en_diagnostico')).toBe('vivo');
    expect(tonoDe('en_reparacion')).toBe('vivo');
    expect(tonoDe('terminado')).toBe('listo');
    expect(tonoDe('entregado')).toBe('listo');
    expect(tonoDe('cancelado')).toBe('neutro');
    expect(tonoDe('recibido')).toBe('neutro');
  });

  it('nombra los estados en español', () => {
    expect(NOMBRE_ESTADO.diagnosticado).toBe('Por aprobar');
    expect(NOMBRE_ESTADO.en_reparacion).toBe('En reparación');
  });

  it('convierte una fecha al formato de datetime-local', () => {
    expect(aEntradaLocal(new Date(2026, 9, 22, 8, 5))).toBe('2026-10-22T08:05');
  });
});

describe('permisos en la interfaz', () => {
  it('cada rol empieza en su pantalla', () => {
    expect(inicioDe('mecanico')).toBe('/mis-trabajos');
    expect(inicioDe('recepcionista')).toBe('/panel');
    expect(inicioDe('administrador')).toBe('/panel');
    expect(inicioDe('concesionario')).toBe('/sin-acceso');
  });

  it('el mecánico ve sus trabajos, órdenes e inventario; nada de administración', () => {
    expect(enlacesDe('mecanico').map((e) => e.a)).toEqual(['/mis-trabajos', '/ordenes', '/inventario']);
  });

  it('la recepcionista ve panel, órdenes, clientes e inventario', () => {
    expect(enlacesDe('recepcionista').map((e) => e.a)).toEqual(['/panel', '/ordenes', '/clientes', '/inventario']);
  });

  it('el administrador además ve usuarios, roles e integraciones', () => {
    expect(enlacesDe('administrador').map((e) => e.a)).toEqual(
      expect.arrayContaining(['/usuarios', '/roles', '/integraciones', '/clientes']),
    );
  });

  it('trabajar: el mecánico asignado o el administrador', () => {
    expect(puede.trabajar('mecanico', true)).toBe(true);
    expect(puede.trabajar('mecanico', false)).toBe(false);
    expect(puede.trabajar('administrador', false)).toBe(true);
    expect(puede.trabajar('recepcionista', true)).toBe(false);
  });

  it('el mecánico consulta el inventario pero no lo edita', () => {
    expect(puede.verInventario('mecanico')).toBe(true);
    expect(puede.editarInventario('mecanico')).toBe(false);
    expect(puede.editarInventario('recepcionista')).toBe(true);
  });
});

describe('costo estimado (igual que la API)', () => {
  it('suma horas × tarifa, servicios y repuestos', () => {
    expect(
      costoEstimado(
        [
          { horasEstimadas: 1.5, valorServicio: 20000, repuestos: [{ cantidad: 4, precioUnitario: 38000 }] },
          { horasEstimadas: 0.5, valorServicio: 0, repuestos: [{ cantidad: 1, precioUnitario: 25000 }] },
        ],
        60000,
      ),
    ).toEqual({ horas: 2, manoObra: 120000, servicios: 20000, repuestos: 177000, total: 317000 });
  });

  it('los campos vacíos o inválidos cuentan como 0', () => {
    expect(costoEstimado([{ horasEstimadas: NaN, valorServicio: 0, repuestos: [] }], 60000).total).toBe(0);
  });
});
