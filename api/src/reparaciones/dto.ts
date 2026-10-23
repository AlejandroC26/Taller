import { z } from 'zod';

export const horasDto = z.object({
  inicio: z.iso.datetime({ offset: true, message: 'Fecha de inicio inválida (ISO 8601)' }),
  fin: z.iso.datetime({ offset: true, message: 'Fecha de fin inválida (ISO 8601)' }),
  tareaId: z.number().int().positive().optional(),
  nota: z.string().trim().max(300).default(''),
  // Solo el administrador registra horas a nombre de otro mecánico.
  mecanicoId: z.uuid().optional(),
});

export const parteDto = z.object({
  itemId: z.number().int().positive('Elija un ítem del inventario'),
  cantidad: z.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad mínima es 1'),
});

export const tareaHechaDto = z.object({ completada: z.boolean() });

export type DatosHoras = z.infer<typeof horasDto>;
