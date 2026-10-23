import { describe, expect, it } from 'vitest';
import { clienteDto, editarVehiculoDto, normalizarPlaca, vehiculoDto } from './dto';

describe('validación de clientes y vehículos', () => {
  it('normaliza la placa: mayúsculas, sin espacios ni guiones', () => {
    expect(normalizarPlaca(' abc-12 3 ')).toBe('ABC123');
    expect(vehiculoDto.parse({ placa: 'abc 123', marca: 'Mazda', modelo: '3', anio: 2020 }).placa).toBe('ABC123');
  });

  it('rechaza placas con símbolos o muy cortas', () => {
    expect(vehiculoDto.safeParse({ placa: 'A$1', marca: 'M', modelo: 'X', anio: 2020 }).success).toBe(false);
  });

  it('rechaza años fuera de rango y kilometraje negativo', () => {
    const base = { placa: 'ABC123', marca: 'Mazda', modelo: '3' };
    expect(vehiculoDto.safeParse({ ...base, anio: 1900 }).success).toBe(false);
    expect(vehiculoDto.safeParse({ ...base, anio: new Date().getFullYear() + 5 }).success).toBe(false);
    expect(vehiculoDto.safeParse({ ...base, anio: 2020, kilometraje: -1 }).success).toBe(false);
  });

  it('al editar un vehículo la placa no cambia', () => {
    expect(editarVehiculoDto.parse({ placa: 'XYZ999', color: 'Rojo' })).toEqual({ color: 'Rojo' });
  });

  it('el cliente exige documento y teléfono válidos; correo es opcional', () => {
    const cliente = { nombre: 'Ana', apellido: 'Ruiz', documento: '52123456', telefono: '3001112233' };
    expect(clienteDto.safeParse(cliente).success).toBe(true);
    expect(clienteDto.safeParse({ ...cliente, correo: 'no-es-correo' }).success).toBe(false);
    expect(clienteDto.safeParse({ ...cliente, documento: '' }).success).toBe(false);
  });
});
