import { z } from 'zod';
import { CAUSAS } from '../garantias/reglas';

// El repuesto se elige del catálogo de la tienda (buscar_repuestos_tienda) por su código
// universal. Nombre y categoría se copian del catálogo al guardar.
export const repuestoDto = z.object({
  codigoRepuesto: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Elija el repuesto del catálogo de la tienda')
    .max(50, 'El código del repuesto tiene hasta 50 caracteres'),
  cantidad: z.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad mínima es 1').max(100),
});

export const tareaDto = z.object({
  // Con id se actualiza ese servicio; sin id se crea.
  id: z.number().int().positive().optional(),
  sku: z.string().trim().toUpperCase().min(3, 'Elija un servicio del catálogo'),
  descripcion: z.string().trim().max(1000).default(''),
  causa: z.enum(CAUSAS).nullable().default(null),
  // Sin dictamen explícito se usa el sugerido por la causa.
  garantiaAplica: z.boolean().optional(),
  garantiaMotivo: z.string().trim().max(1000).default(''),
  repuestos: z.array(repuestoDto).max(30).default([]),
});

export const diagnosticoDto = z.object({
  observaciones: z.string().trim().max(4000).default(''),
  tareas: z.array(tareaDto).max(50, 'Máximo 50 servicios').default([]),
});

export const remitirDto = z.object({
  taller: z.union([z.number().int().positive(), z.string().trim().min(2)]),
  nota: z.string().trim().min(5, 'Explique al especialista qué encontró en la revisión').max(2000),
});

export type DatosDiagnostico = z.infer<typeof diagnosticoDto>;
