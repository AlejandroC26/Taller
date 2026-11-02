import { describe, expect, it, vi } from 'vitest';
import { prediagnosticar, tiempoModeloMs } from './agente';
import { decidirRuta, elegirSede, porPalabrasClave, validarSalidaModelo } from './reglas';
import type { SedeCatalogo, ServicioCatalogo } from './reglas';

const catalogo: ServicioCatalogo[] = [
  { sku: 'REV-GENERAL', nombre: 'Revisión general', especialidad: 'mantenimiento_general', palabrasClave: ['ruido raro', 'no se'] },
  { sku: 'FRE-PASTILLAS', nombre: 'Pastillas', especialidad: 'frenos', palabrasClave: ['frenar', 'chilla', 'pastillas'] },
  { sku: 'FRE-DISCOS', nombre: 'Discos', especialidad: 'frenos', palabrasClave: ['vibra al frenar'] },
  { sku: 'ELE-BATERIA', nombre: 'Batería', especialidad: 'electrico', palabrasClave: ['bateria', 'no prende'] },
];
const sedes: SedeCatalogo[] = [
  { id: 1, codigo: 'PL-CENTRO', nombre: 'Centro', tipo: 'mantenimiento', especialidades: ['mantenimiento_general'], activo: true },
  { id: 2, codigo: 'PL-FRENOS', nombre: 'Frenos', tipo: 'especializado', especialidades: ['frenos', 'suspension'], activo: true },
  { id: 3, codigo: 'PL-MOTOR', nombre: 'Motor', tipo: 'especializado', especialidades: ['motor', 'electrico'], activo: false },
];

describe('prediagnóstico por reglas', () => {
  it('un síntoma claro da la especialidad con confianza alta', () => {
    const r = porPalabrasClave('Cuando voy a frenar el carro chilla muchísimo', catalogo);
    expect(r).toMatchObject({ especialidad: 'frenos', servicios: ['FRE-PASTILLAS'], confianza: 1 });
  });

  it('sin tildes ni mayúsculas igual coincide', () => {
    expect(porPalabrasClave('La BATERÍA no prende', catalogo).especialidad).toBe('electrico');
  });

  it('si apunta a dos sistemas baja la confianza', () => {
    const r = porPalabrasClave('chilla al frenar y la bateria no prende', catalogo);
    expect(r.confianza).toBeLessThan(0.6);
  });

  it('sin coincidencias: mantenimiento general con confianza cero', () => {
    expect(porPalabrasClave('anda raro, no sé qué tiene', catalogo)).toMatchObject({ especialidad: 'mantenimiento_general', confianza: 0 });
  });

  it('va directo al especialista solo con confianza alta y sede activa', () => {
    expect(decidirRuta('frenos', 0.9, sedes)).toBe('especializada');
    expect(decidirRuta('frenos', 0.4, sedes)).toBe('revision_general');
    expect(decidirRuta('electrico', 0.9, sedes)).toBe('revision_general'); // la sede de eléctrico está inactiva
    expect(decidirRuta('mantenimiento_general', 1, sedes)).toBe('revision_general');
  });

  it('elige la sede especializada o la de mantenimiento', () => {
    expect(elegirSede('especializada', 'frenos', sedes)?.codigo).toBe('PL-FRENOS');
    expect(elegirSede('revision_general', 'frenos', sedes)?.codigo).toBe('PL-CENTRO');
  });

  it('solo acepta del modelo lo que está en el catálogo', () => {
    expect(validarSalidaModelo({ especialidad: 'frenos', servicios: ['FRE-PASTILLAS', 'INVENTADO'], confianza: 0.8, resumen: 'x' }, catalogo)).toEqual({
      especialidad: 'frenos',
      servicios: ['FRE-PASTILLAS'],
      confianza: 0.8,
      resumen: 'x',
    });
    expect(validarSalidaModelo({ especialidad: 'carroceria', confianza: 0.9 }, catalogo)).toBeNull();
    expect(validarSalidaModelo({ especialidad: 'frenos', confianza: 7 }, catalogo)).toBeNull();
    expect(validarSalidaModelo('texto', catalogo)).toBeNull();
  });
});

describe('agente de prediagnóstico', () => {
  it('espera al modelo 8 s por defecto; LOCAL_TIEMPO_MS lo cambia dentro de 1 a 50 s', () => {
    expect(tiempoModeloMs({})).toBe(8_000);
    expect(tiempoModeloMs({ LOCAL_TIEMPO_MS: '15000' })).toBe(15_000);
    expect(tiempoModeloMs({ LOCAL_TIEMPO_MS: '10' })).toBe(1_000);
    expect(tiempoModeloMs({ LOCAL_TIEMPO_MS: '999999' })).toBe(50_000);
    expect(tiempoModeloMs({ LOCAL_TIEMPO_MS: 'abc' })).toBe(8_000);
  });

  it('usa la respuesta del modelo cuando es válida y segura', async () => {
    const modelo = vi.fn(async (_sistema: string, _usuario: string) => ({ especialidad: 'frenos', servicios: ['FRE-DISCOS'], confianza: 0.85, resumen: 'Vibración al frenar: discos' }));
    const r = await prediagnosticar(['el pedal vibra'], 'Mazda 3', catalogo, sedes, modelo);
    expect(r).toMatchObject({ fuente: 'modelo', especialidad: 'frenos', ruta: 'especializada', taller: { codigo: 'PL-FRENOS' } });
    expect(modelo.mock.calls[0][0]).toContain('FRE-DISCOS: Discos — frenos');
  });

  it('si el modelo falla, usa las reglas', async () => {
    const r = await prediagnosticar(['chilla al frenar'], 'Mazda 3', catalogo, sedes, async () => {
      throw new Error('sin conexión');
    });
    expect(r).toMatchObject({ fuente: 'reglas', especialidad: 'frenos', ruta: 'especializada' });
  });

  it('si el modelo duda y las reglas están más seguras, ganan las reglas', async () => {
    const r = await prediagnosticar(['chilla al frenar'], 'Mazda 3', catalogo, sedes, async () => ({
      especialidad: 'electrico',
      servicios: [],
      confianza: 0.2,
      resumen: '?',
    }));
    expect(r.fuente).toBe('reglas');
  });

  it('si nadie sabe qué tiene, va a revisión general en mantenimiento', async () => {
    const r = await prediagnosticar(['hace un ruido raro, no sé qué es'], 'Gol', catalogo, sedes, async () => {
      throw new Error('x');
    });
    expect(r).toMatchObject({ ruta: 'revision_general', taller: { codigo: 'PL-CENTRO' } });
  });
});
