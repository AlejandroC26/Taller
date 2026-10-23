import { conflicto, invalido } from '../comun/errores';
import type { TipoMovimiento } from './movimiento.entity';

// Un ítem está en alerta cuando sus existencias llegan al nivel de alerta.
export const enAlerta = (item: { cantidad: number; nivelAlerta: number }) =>
  item.cantidad <= item.nivelAlerta;

// Calcula el nuevo saldo de un movimiento.
//   entrada: suma la cantidad.  salida: la resta, sin quedar en negativo.
//   ajuste: la cantidad es el conteo físico, es decir, el nuevo saldo.
export function aplicarMovimiento(
  saldoActual: number,
  tipo: TipoMovimiento,
  cantidad: number,
  nombre = 'el ítem',
): { saldo: number; diferencia: number } {
  if (!Number.isInteger(cantidad)) throw invalido('La cantidad debe ser un número entero');
  if (tipo === 'ajuste') {
    if (cantidad < 0) throw invalido('El conteo de un ajuste no puede ser negativo');
    return { saldo: cantidad, diferencia: cantidad - saldoActual };
  }
  if (cantidad <= 0) throw invalido('La cantidad debe ser mayor que cero');
  if (tipo === 'entrada') return { saldo: saldoActual + cantidad, diferencia: cantidad };
  if (cantidad > saldoActual) {
    throw conflicto(
      `No hay existencias suficientes de ${nombre}: hay ${saldoActual} y se piden ${cantidad}`,
    );
  }
  return { saldo: saldoActual - cantidad, diferencia: -cantidad };
}
