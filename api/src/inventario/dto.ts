import { z } from 'zod';
import { TIPOS_MOVIMIENTO } from './movimiento.entity';

const entero = (campo: string) =>
  z.number().int(`${campo} debe ser un número entero`).min(0, `${campo} no puede ser negativo`);

// Campos editables, sin valores por defecto: al editar, lo que no se envía no cambia.
const camposItem = {
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  precio: z.number().min(0, 'El precio no puede ser negativo').max(9_999_999_999),
  nivelAlerta: entero('El nivel de alerta'),
  categoriaId: z.number().int().positive('Elija una categoría'),
};

export const itemDto = z.object({
  ...camposItem,
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9._-]{2,40}$/, 'Código inválido: de 2 a 40 letras, números, punto o guion'),
  cantidad: entero('La cantidad').default(0),
  nivelAlerta: camposItem.nivelAlerta.default(0),
});

// Las existencias no se editan directo: cambian con movimientos, para que quede rastro.
export const editarItemDto = z
  .object(camposItem)
  .partial()
  .extend({ activo: z.boolean().optional() });

export const movimientoDto = z.object({
  tipo: z.enum(TIPOS_MOVIMIENTO),
  cantidad: z.number().int('La cantidad debe ser un número entero'),
  nota: z.string().trim().max(200).default(''),
});

export const categoriaDto = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(60),
});

export type DatosItem = z.infer<typeof itemDto>;
export type EditarItem = z.infer<typeof editarItemDto>;
export type DatosMovimiento = z.infer<typeof movimientoDto>;
