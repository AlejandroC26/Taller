import { describe, expect, it } from 'vitest';
import { concesionarioSimulado } from '../integraciones/concesionario/simulado/simulado';
import { cabeceraSimulada, RELACIONES } from '../integraciones/concesionario/simulado/datos';
import { causaProbable, coberturaDe, conKilometraje, decidirComoConcesionario, dictamenSugerido, garantiaProbable, pagadorPorCausa, requiereEvidencia } from './reglas';
import type { ServicioAValidar } from './reglas';

const hoy = new Date('2026-10-26T12:00:00Z');
const servicio = (cambios: Partial<ServicioAValidar> = {}): ServicioAValidar => ({
  tareaId: 1,
  sku: 'FRE-PASTILLAS',
  especialidad: 'frenos',
  causa: 'defecto_fabrica',
  aplica: true,
  motivo: 'Pastillas cristalizadas a los 15.000 km',
  evidencias: ['http://x/api/evidencias/1'],
  ...cambios,
});

describe('reglas de garantía', () => {
  it('el dictamen sugerido sale de la causa', () => {
    expect(dictamenSugerido('defecto_fabrica')).toBe(true);
    expect(dictamenSugerido('repuesto_defectuoso')).toBe(true);
    expect(dictamenSugerido('mala_instalacion_taller')).toBe(true);
    expect(dictamenSugerido('manipulacion_cliente')).toBe(false);
    expect(dictamenSugerido('desgaste_normal')).toBe(false);
    expect(dictamenSugerido(null)).toBe(false);
  });

  it('quién paga una garantía válida (por dispersión)', () => {
    expect(pagadorPorCausa('defecto_fabrica')).toBe('fabricante');
    expect(pagadorPorCausa('repuesto_defectuoso')).toBe('tienda');
    expect(pagadorPorCausa('mala_instalacion_taller')).toBe('taller');
    expect(pagadorPorCausa('manipulacion_cliente')).toBe('cliente');
  });

  it('pide evidencia si el dictamen aplica o la orden vino por garantía', () => {
    expect(requiereEvidencia(true, false)).toBe(true);
    expect(requiereEvidencia(false, true)).toBe(true);
    expect(requiereEvidencia(false, false)).toBe(false);
  });

  it('cobertura: 3 años o 60.000 km, lo que pase primero', () => {
    expect(coberturaDe('2025-03-14', 18200, ['frenos'], hoy)).toMatchObject({ vigente: true, vence: '2028-03-14' });
    expect(coberturaDe('2022-05-09', 30000, ['frenos'], hoy)).toMatchObject({ vigente: false, motivo: expect.stringContaining('venció') });
    expect(coberturaDe('2025-03-14', 75000, ['frenos'], hoy)).toMatchObject({ vigente: false, motivo: expect.stringContaining('km') });
  });
});

describe('decisión del concesionario simulado', () => {
  const vigente = coberturaDe('2025-03-14', 18200, ['frenos', 'motor'], hoy);

  it('respeta el dictamen del mecánico con cobertura y evidencias', () => {
    expect(decidirComoConcesionario(vigente, servicio())).toMatchObject({ valida: true, motivo: expect.stringContaining('defecto de fábrica') });
  });

  it('manipulación del cliente: no válida, con el motivo del taller', () => {
    const r = decidirComoConcesionario(vigente, servicio({ causa: 'manipulacion_cliente', aplica: false, motivo: 'Sensor desconectado a mano' }));
    expect(r).toEqual({ tareaId: 1, valida: false, motivo: 'Manipulación del cliente: Sensor desconectado a mano' });
  });

  it('desgaste normal no lo cubre', () => {
    expect(decidirComoConcesionario(vigente, servicio({ causa: 'desgaste_normal', aplica: false })).motivo).toMatch(/Desgaste normal/);
  });

  it('niega fuera de vigencia, sistema no cubierto o sin evidencias', () => {
    const vencida = coberturaDe('2020-02-17', 98000, ['frenos'], hoy);
    expect(decidirComoConcesionario(vencida, servicio()).valida).toBe(false);
    expect(decidirComoConcesionario(vigente, servicio({ especialidad: 'suspension' })).motivo).toMatch(/no cubre el sistema suspension/);
    expect(decidirComoConcesionario(vigente, servicio({ evidencias: [] })).motivo).toMatch(/Sin evidencias/);
  });
});

describe('concesionario simulado', () => {
  const concesionario = concesionarioSimulado(() => hoy);

  it('responde la relación con la cabecera del VIN y la garantía', async () => {
    const r = await concesionario.consultarRelacion('rel-1001');
    expect(r).toMatchObject({
      idRelacion: 'REL-1001',
      cliente: 'Laura Mejía',
      cabeceraVin: { marca: 'Renault', modelo: 'Duster', carroceria: 'SUV', puertas: 5, anio: 2023 },
      garantia: { vigente: true },
    });
    expect(await concesionario.consultarRelacion('REL-9999')).toBeNull();
  });

  it('todas las relaciones de prueba tienen un VIN que se decodifica', () => {
    for (const r of RELACIONES) expect(cabeceraSimulada(r.vin)).not.toBeNull();
    expect(cabeceraSimulada('XXXXXX00000000000')).toBeNull();
  });

  it('valida la garantía de inmediato, servicio por servicio', async () => {
    const r = await concesionario.validarGarantia({
      codigo: 'OT-0001',
      idRelacion: 'REL-1004',
      vin: '',
      porGarantia: true,
      motivoReclamo: null,
      servicios: [servicio()],
    });
    expect(r).toEqual([{ tareaId: 1, valida: false, motivo: expect.stringContaining('venció') }]);
  });
});

describe('garantía probable antes de ver el carro', () => {
  const vigente = { vigente: true, vence: '2028-03-14', kmMaximo: 60_000, cubre: ['frenos', 'motor'] as ('frenos' | 'motor')[] };

  it('la causa probable sale de las pistas de lo que cuenta el cliente', () => {
    expect(causaProbable('Los frenos chillan mucho desde hace una semana')).toBe('desgaste_normal');
    expect(causaProbable('Falla desde que lo compré, viene de fábrica')).toBe('defecto_fabrica');
    expect(causaProbable('Después del servicio en otro taller quedó sonando')).toBe('mala_instalacion_taller');
    expect(causaProbable('Me chocaron y ahora vibra')).toBe('manipulacion_cliente');
    expect(causaProbable('Hace un ruido raro')).toBeNull();
  });

  it('aplica si está vigente, cubre el sistema y la causa no la excluye', () => {
    expect(garantiaProbable(vigente, 'motor', 'falla desde nuevo')).toMatchObject({ aplica_probable: true, causa_probable: 'defecto_fabrica' });
    expect(garantiaProbable(vigente, 'motor', 'hace un ruido raro')).toMatchObject({ aplica_probable: true, causa_probable: null });
    expect(garantiaProbable(vigente, 'frenos', 'chillan los frenos')).toMatchObject({ aplica_probable: false, causa_probable: 'desgaste_normal' });
    expect(garantiaProbable(vigente, 'suspension', 'desde nuevo')).toMatchObject({ aplica_probable: false });
    expect(garantiaProbable({ ...vigente, vigente: false }, 'motor', 'desde nuevo')).toMatchObject({ aplica_probable: false });
  });

  it('el kilometraje que reporta el cliente puede vencer la garantía', () => {
    expect(conKilometraje(vigente, 98_000)).toMatchObject({ vigente: false, motivo: expect.stringContaining('60.000 km') });
    expect(conKilometraje(vigente, 30_000)).toBe(vigente);
    expect(conKilometraje(vigente)).toBe(vigente);
  });
});
