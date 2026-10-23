import { describe, expect, it } from 'vitest';
import { diagnosticoDto, repuestoDto, tareaDto } from './dto';
import { costoEstimado } from './reglas';

describe('costo estimado del diagnóstico', () => {
  it('suma horas × tarifa, servicios y repuestos', () => {
    const costo = costoEstimado(
      [
        { horasEstimadas: 1.5, valorServicio: 20000, repuestos: [{ cantidad: 4, precioUnitario: 38000 }] },
        { horasEstimadas: 0.5, valorServicio: 0, repuestos: [{ cantidad: 1, precioUnitario: 25000 }] },
      ],
      60000,
    );
    expect(costo).toEqual({
      horas: 2,
      manoObra: 120000,
      servicios: 20000,
      repuestos: 177000,
      total: 317000,
    });
  });

  it('sin tareas el costo es cero', () => {
    expect(costoEstimado([], 60000).total).toBe(0);
  });

  it('redondea a centavos', () => {
    expect(costoEstimado([{ horasEstimadas: 0.33, valorServicio: 0, repuestos: [] }], 33333.33).manoObra).toBe(11000);
  });
});

describe('validación del diagnóstico', () => {
  it('un repuesto necesita ítem o descripción', () => {
    expect(repuestoDto.safeParse({ cantidad: 1 }).success).toBe(false);
    expect(repuestoDto.safeParse({ itemId: 3, cantidad: 2 }).success).toBe(true);
    expect(repuestoDto.safeParse({ descripcion: 'Sensor de oxígeno', cantidad: 1, precioUnitario: 180000 }).success).toBe(true);
  });

  it('la cantidad de un repuesto es entera y mínimo 1', () => {
    expect(repuestoDto.safeParse({ itemId: 3, cantidad: 0 }).success).toBe(false);
    expect(repuestoDto.safeParse({ itemId: 3, cantidad: 1.5 }).success).toBe(false);
  });

  it('una tarea sin repuestos queda con lista vacía y valor 0', () => {
    expect(tareaDto.parse({ descripcion: 'Revisar frenos', horasEstimadas: 1 })).toEqual({
      descripcion: 'Revisar frenos',
      horasEstimadas: 1,
      valorServicio: 0,
      requierePiezas: false,
      repuestos: [],
    });
  });

  it('rechaza horas negativas y más de 50 pasos', () => {
    expect(tareaDto.safeParse({ descripcion: 'Paso', horasEstimadas: -1 }).success).toBe(false);
    const pasos = Array.from({ length: 51 }, () => ({ descripcion: 'Paso', horasEstimadas: 1 }));
    expect(diagnosticoDto.safeParse({ tareas: pasos }).success).toBe(false);
  });
});
