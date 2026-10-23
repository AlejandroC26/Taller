import { describe, expect, it } from 'vitest';
import { horasDto, parteDto } from './dto';
import { horasEntre, lineasFactura, liquidar, MAXIMO_HORAS_REGISTRO } from './reglas';

const h = (texto: string) => new Date(`2026-10-22T${texto}:00-05:00`);

describe('registro de horas', () => {
  it('calcula las horas entre inicio y fin', () => {
    expect(horasEntre(h('08:00'), h('10:30'))).toBe(2.5);
    expect(horasEntre(h('08:00'), h('08:20'))).toBe(0.33);
  });

  it('el fin debe ser posterior al inicio', () => {
    expect(() => horasEntre(h('10:00'), h('09:00'))).toThrow(/posterior/);
    expect(() => horasEntre(h('10:00'), h('10:00'))).toThrow();
  });

  it(`no acepta registros de más de ${MAXIMO_HORAS_REGISTRO} horas ni fechas inválidas`, () => {
    expect(() => horasEntre(h('00:00'), new Date('2026-10-23T18:00:00-05:00'))).toThrow(/16 horas/);
    expect(() => horasEntre(new Date('x'), h('10:00'))).toThrow(/no son válidas/);
  });

  it('la ruta exige fechas ISO con zona horaria', () => {
    expect(horasDto.safeParse({ inicio: '2026-10-22T08:00:00-05:00', fin: '2026-10-22T10:00:00-05:00' }).success).toBe(true);
    expect(horasDto.safeParse({ inicio: 'ayer', fin: 'hoy' }).success).toBe(false);
  });

  it('una parte usada exige ítem y cantidad entera', () => {
    expect(parteDto.safeParse({ itemId: 1, cantidad: 2 }).success).toBe(true);
    expect(parteDto.safeParse({ itemId: 1, cantidad: 0 }).success).toBe(false);
  });
});

describe('liquidación', () => {
  const datos = {
    tarifaHora: 60000,
    tareas: [
      { descripcion: 'Cambio de aceite', valorServicio: 30000, completada: true },
      { descripcion: 'Alineación', valorServicio: 50000, completada: false },
    ],
    horas: [{ horas: 1.5 }, { horas: 0.75 }],
    partes: [
      { descripcion: 'Aceite 5W-30', cantidad: 4, precioUnitario: 38000 },
      { descripcion: 'Filtro de aceite', cantidad: 1, precioUnitario: 25000 },
    ],
  };

  it('cobra servicios hechos, tiempo real y partes gastadas', () => {
    expect(liquidar(datos)).toEqual({
      horas: 2.25,
      manoObra: 135000,
      servicios: 30000,
      repuestos: 177000,
      total: 342000,
    });
  });

  it('las tareas sin completar no se cobran', () => {
    const sinHacer = { ...datos, tareas: datos.tareas.map((t) => ({ ...t, completada: false })) };
    expect(liquidar(sinHacer).servicios).toBe(0);
  });

  it('arma las líneas de la factura', () => {
    expect(lineasFactura(datos)).toEqual([
      { concepto: 'Servicio: Cambio de aceite', cantidad: 1, valor_unitario: 30000 },
      { concepto: 'Mano de obra (horas)', cantidad: 2.25, valor_unitario: 60000 },
      { concepto: 'Aceite 5W-30', cantidad: 4, valor_unitario: 38000 },
      { concepto: 'Filtro de aceite', cantidad: 1, valor_unitario: 25000 },
    ]);
  });

  it('la suma de las líneas da el total de la liquidación', () => {
    const suma = lineasFactura(datos).reduce((s, l) => s + l.cantidad * l.valor_unitario, 0);
    expect(suma).toBe(liquidar(datos).total);
  });
});
