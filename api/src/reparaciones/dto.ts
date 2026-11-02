import { z } from 'zod';

export const horasDto = z.object({
  inicio: z.iso.datetime({ offset: true, message: 'Fecha de inicio inválida (ISO 8601)' }),
  fin: z.iso.datetime({ offset: true, message: 'Fecha de fin inválida (ISO 8601)' }),
  tareaId: z.number().int().positive().optional(),
  nota: z.string().trim().max(300).default(''),
  // Solo la gestión registra horas a nombre de otro mecánico.
  mecanicoId: z.uuid().optional(),
});

// Lo que se usó y gastó: código universal y cantidad. Si viene de la orden de compra de
// facturación, se enlaza con compraId.
export const parteDto = z.object({
  codigoRepuesto: z.string().trim().toUpperCase().min(1, 'Indique el código del repuesto').max(50, 'El código tiene hasta 50 caracteres'),
  descripcion: z.string().trim().max(200).optional(),
  cantidad: z.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad mínima es 1').max(100),
  compraId: z.number().int().positive().optional(),
  nota: z.string().trim().max(300).default(''),
});

export const tareaHechaDto = z.object({ completada: z.boolean() });

export type DatosHoras = z.infer<typeof horasDto>;
export type DatosParte = z.infer<typeof parteDto>;
