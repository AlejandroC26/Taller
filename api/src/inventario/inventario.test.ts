import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { actorDe } from '../comun/pruebas';
import { editarItemDto, itemDto, movimientoDto } from './dto';
import { moverExistencias } from './inventario.service';
import { aplicarMovimiento, enAlerta } from './reglas';

describe('reglas de inventario', () => {
  it('un ítem está en alerta cuando llega a su nivel de alerta', () => {
    expect(enAlerta({ cantidad: 3, nivelAlerta: 3 })).toBe(true);
    expect(enAlerta({ cantidad: 2, nivelAlerta: 3 })).toBe(true);
    expect(enAlerta({ cantidad: 4, nivelAlerta: 3 })).toBe(false);
  });

  it('una entrada suma', () => {
    expect(aplicarMovimiento(5, 'entrada', 3)).toEqual({ saldo: 8, diferencia: 3 });
  });

  it('una salida resta y no deja el saldo en negativo', () => {
    expect(aplicarMovimiento(5, 'salida', 5)).toEqual({ saldo: 0, diferencia: -5 });
    expect(() => aplicarMovimiento(2, 'salida', 3, 'Filtro')).toThrow(/Filtro: hay 2 y se piden 3/);
  });

  it('una salida sin existencias responde 409', () => {
    try {
      aplicarMovimiento(0, 'salida', 1);
      expect.unreachable();
    } catch (e) {
      expect((e as { estado: number }).estado).toBe(409);
    }
  });

  it('un ajuste fija el conteo físico y guarda la diferencia', () => {
    expect(aplicarMovimiento(10, 'ajuste', 7)).toEqual({ saldo: 7, diferencia: -3 });
    expect(() => aplicarMovimiento(10, 'ajuste', -1)).toThrow();
  });

  it('rechaza cantidades en cero, negativas o con decimales', () => {
    expect(() => aplicarMovimiento(5, 'entrada', 0)).toThrow();
    expect(() => aplicarMovimiento(5, 'salida', -2)).toThrow();
    expect(() => aplicarMovimiento(5, 'entrada', 1.5)).toThrow('entero');
  });
});

describe('validación de inventario', () => {
  const item = { codigo: 'fil-01', nombre: 'Filtro', precio: 25000, categoriaId: 2 };

  it('normaliza el código a mayúsculas y pone 0 por defecto', () => {
    expect(itemDto.parse(item)).toMatchObject({ codigo: 'FIL-01', cantidad: 0, nivelAlerta: 0 });
  });

  it('rechaza precio negativo y nivel de alerta con decimales', () => {
    expect(itemDto.safeParse({ ...item, precio: -1 }).success).toBe(false);
    expect(itemDto.safeParse({ ...item, nivelAlerta: 1.5 }).success).toBe(false);
  });

  it('al editar no se pueden cambiar las existencias ni el código', () => {
    expect(editarItemDto.parse({ cantidad: 99, codigo: 'X', precio: 10 })).toEqual({ precio: 10 });
  });

  it('el tipo de movimiento debe ser entrada, salida o ajuste', () => {
    expect(movimientoDto.safeParse({ tipo: 'robo', cantidad: 1 }).success).toBe(false);
    expect(movimientoDto.parse({ tipo: 'entrada', cantidad: 4 }).nota).toBe('');
  });
});

describe('moverExistencias', () => {
  const gestor = (fila?: { cantidad: number; nombre: string; precio: string }) =>
    ({
      query: vi.fn(async () => (fila ? [fila] : [])),
      update: vi.fn(),
      create: vi.fn((_clase: unknown, datos: unknown) => datos),
      save: vi.fn(async (datos: unknown) => datos),
    }) as unknown as EntityManager & Record<'query' | 'update' | 'create' | 'save', ReturnType<typeof vi.fn>>;

  it('bloquea la fila, actualiza el saldo y deja el movimiento con la orden', async () => {
    const tx = gestor({ cantidad: 10, nombre: 'Filtro', precio: '25000.00' });
    const r = await moverExistencias(tx, 3, 'salida', 4, actorDe('mecanico', 'm1'), { ordenId: 7 });
    expect(r).toEqual({ saldo: 6, nombre: 'Filtro', precio: 25000 });
    expect(tx.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(tx.update).toHaveBeenCalledWith(expect.anything(), 3, { cantidad: 6 });
    expect(tx.save).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'salida', cantidad: -4, saldo: 6, orden: { id: 7 }, usuario: { id: 'm1' } }),
    );
  });

  it('sin existencias suficientes no cambia nada', async () => {
    const tx = gestor({ cantidad: 1, nombre: 'Batería', precio: '420000' });
    await expect(moverExistencias(tx, 3, 'salida', 2, actorDe('mecanico'))).rejects.toMatchObject({ estado: 409 });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.save).not.toHaveBeenCalled();
  });

  it('un ítem inexistente o inactivo responde 404', async () => {
    await expect(moverExistencias(gestor(), 99, 'entrada', 1, actorDe('recepcionista'))).rejects.toMatchObject({
      estado: 404,
    });
  });
});
