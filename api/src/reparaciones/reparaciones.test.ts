import { describe, expect, it } from 'vitest';
import { parteDto } from './dto';
import { eficiencia, horasEntre } from './reglas';

const h = (t: string) => new Date(`2026-10-26T${t}:00-05:00`);

describe('horas de control', () => {
  it('calcula las horas trabajadas', () => {
    expect(horasEntre(h('08:00'), h('10:30'))).toBe(2.5);
  });

  it('rechaza fin antes del inicio, más de 16 horas y fechas inválidas', () => {
    expect(() => horasEntre(h('10:00'), h('09:00'))).toThrow(/posterior/);
    expect(() => horasEntre(h('00:00'), new Date('2026-10-27T18:00:00-05:00'))).toThrow(/16 horas/);
    expect(() => horasEntre(new Date('x'), h('10:00'))).toThrow(/no son válidas/);
  });

  it('la eficiencia compara horas estándar del SKU con las reales', () => {
    expect(eficiencia(2, 2.5)).toBe(0.8);
    expect(eficiencia(2, 0)).toBeNull();
  });
});

describe('partes usadas', () => {
  it('solo código universal, cantidad y, si aplica, la línea de compra', () => {
    expect(parteDto.parse({ codigoRepuesto: 'pas-del-cer', cantidad: 1, compraId: 3 })).toEqual({
      codigoRepuesto: 'PAS-DEL-CER',
      cantidad: 1,
      compraId: 3,
      nota: '',
    });
    expect(parteDto.safeParse({ codigoRepuesto: 'X', cantidad: 1 }).success).toBe(false);
  });
});
