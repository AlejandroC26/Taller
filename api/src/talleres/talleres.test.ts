import { describe, expect, it } from 'vitest';
import { diaSemana, exigirFranjaLibre, fechaLocal, franjas } from './reglas';

const horario = { dias: [1, 2, 3, 4, 5, 6], apertura: '08:00', cierre: '12:00' };
const antes = new Date('2026-01-01T00:00:00Z');

describe('agenda de una sede', () => {
  it('reconoce el día de la semana en Colombia', () => {
    expect(diaSemana('2026-10-26')).toBe(1); // lunes
    expect(diaSemana('2026-11-01')).toBe(7); // domingo
  });

  it('pasa un instante a la fecha de Colombia', () => {
    expect(fechaLocal('2026-10-27T03:00:00Z')).toBe('2026-10-26');
    expect(fechaLocal('2026-10-27T09:00:00-05:00')).toBe('2026-10-27');
  });

  it('arma franjas de una hora dentro del horario con el cupo de mecánicos', () => {
    const lista = franjas(horario, '2026-10-27', [], 2, antes);
    expect(lista.map((f) => f.inicio)).toEqual([
      '2026-10-27T08:00:00-05:00',
      '2026-10-27T09:00:00-05:00',
      '2026-10-27T10:00:00-05:00',
      '2026-10-27T11:00:00-05:00',
    ]);
    expect(lista.every((f) => f.libres === 2)).toBe(true);
  });

  it('descuenta las citas ya tomadas y nunca baja de cero', () => {
    const ocupadas = ['2026-10-27T13:00:00Z', '2026-10-27T13:00:00Z', '2026-10-27T13:00:00Z'];
    const lista = franjas(horario, '2026-10-27', ocupadas, 2, antes);
    expect(lista.find((f) => f.inicio.startsWith('2026-10-27T08'))?.libres).toBe(0);
  });

  it('sin mecánicos el cupo es 1; el domingo no hay franjas; tampoco las que ya pasaron', () => {
    expect(franjas(horario, '2026-10-27', [], 0, antes)[0].libres).toBe(1);
    expect(franjas(horario, '2026-11-01', [], 2, antes)).toEqual([]);
    expect(franjas(horario, '2026-10-27', [], 2, new Date('2026-10-27T14:30:00Z'))).toHaveLength(2);
  });

  it('una fecha mal escrita responde 400', () => {
    expect(() => franjas(horario, '27/10/2026', [], 1, antes)).toThrow(/AAAA-MM-DD/);
  });

  it('solo se agenda en una franja existente y con cupo', () => {
    const lista = franjas(horario, '2026-10-27', ['2026-10-27T13:00:00Z'], 1, antes);
    expect(() => exigirFranjaLibre(lista, '2026-10-27T09:00:00-05:00')).not.toThrow();
    expect(() => exigirFranjaLibre(lista, '2026-10-27T08:00:00-05:00')).toThrow(/llena/);
    expect(() => exigirFranjaLibre(lista, '2026-10-27T08:30:00-05:00')).toThrow(/no es una franja/);
  });
});
