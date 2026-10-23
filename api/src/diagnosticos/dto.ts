import { z } from 'zod';

export const repuestoDto = z
  .object({
    itemId: z.number().int().positive().optional(),
    descripcion: z.string().trim().max(160).optional(),
    cantidad: z.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad mínima es 1'),
    // Solo para piezas que no están en inventario: precio estimado. Con ítem se usa el
    // precio del inventario.
    precioUnitario: z.number().min(0).optional(),
  })
  .refine((r) => r.itemId || r.descripcion, {
    message: 'Cada repuesto necesita un ítem del inventario o una descripción',
  });

export const tareaDto = z.object({
  descripcion: z.string().trim().min(3, 'Describa el paso').max(1000),
  horasEstimadas: z.number().min(0, 'Las horas no pueden ser negativas').max(200),
  valorServicio: z.number().min(0, 'El valor no puede ser negativo').default(0),
  requierePiezas: z.boolean().default(false),
  repuestos: z.array(repuestoDto).max(30).default([]),
});

// El borrador completo se reemplaza en cada guardado: el paso a paso en orden.
export const diagnosticoDto = z.object({
  observaciones: z.string().trim().max(4000).default(''),
  tarifaHora: z.number().min(0).max(10_000_000).optional(),
  tareas: z.array(tareaDto).max(50, 'Máximo 50 pasos').default([]),
});

export type DatosDiagnostico = z.infer<typeof diagnosticoDto>;
