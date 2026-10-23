import { z } from 'zod';
import { placa } from '../clientes/dto';
import { ESTADOS, ETAPAS } from './reglas';

export const nuevaOrdenDto = z.object({
  placa,
  motivo: z.string().trim().min(3, 'Describa el motivo de ingreso').max(2000),
  kilometraje: z.number().int().min(0, 'El kilometraje no puede ser negativo').optional(),
});

export const asignarDto = z.object({
  mecanicoId: z.uuid('Mecánico inválido'),
  etapa: z.enum(ETAPAS),
});

export const desasignarDto = z.object({ asignacionId: z.number().int().positive() });

// Por esta ruta solo se aprueba (el cliente aceptó el diagnóstico) o se entrega. Los
// demás estados cambian con su acción: asignar, finalizar diagnóstico, terminar.
export const estadoDto = z.object({
  estado: z.enum(['aprobado', 'entregado']),
  nota: z.string().trim().max(300).optional(),
});

export const cancelarDto = z.object({
  motivo: z.string().trim().min(5, 'Explique el motivo de la cancelación').max(500),
});

export const filtroOrdenesDto = z.object({
  estado: z.enum(ESTADOS).optional(),
  buscar: z.string().trim().max(60).optional(),
});

export type NuevaOrden = z.infer<typeof nuevaOrdenDto>;
