import { z } from 'zod';
import { bd } from '../base-datos/conexion';
import { invalido } from '../comun/errores';
import { ESPECIALIDADES } from '../talleres/reglas';
import type { Especialidad } from '../talleres/reglas';
import { Servicio } from './servicio.entity';

export const servicioDto = z.object({
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/, 'SKU inválido'),
  nombre: z.string().trim().min(3).max(120),
  especialidad: z.enum(ESPECIALIDADES),
  precioManoObra: z.number().min(0).max(100_000_000),
  horasEstandar: z.number().min(0.25).max(40),
  palabrasClave: z.array(z.string().trim().min(2)).max(30).default([]),
  descripcion: z.string().trim().max(300).default(''),
  activo: z.boolean().default(true),
});

export const aServicio = (s: Servicio) => ({
  sku: s.sku,
  nombre: s.nombre,
  especialidad: s.especialidad,
  precio_mano_obra: s.precioManoObra,
  horas_estandar: s.horasEstandar,
  descripcion: s.descripcion,
  activo: s.activo,
});

export async function catalogoServicios(soloActivos = true): Promise<Servicio[]> {
  return (await bd()).getRepository(Servicio).find({
    where: soloActivos ? { activo: true } : {},
    order: { especialidad: 'ASC', sku: 'ASC' },
  });
}

export async function listarServicios(especialidad?: Especialidad) {
  return (await catalogoServicios()).filter((s) => !especialidad || s.especialidad === especialidad).map(aServicio);
}

export async function buscarServicio(sku: string): Promise<Servicio> {
  const servicio = await (await bd()).getRepository(Servicio).findOneBy({ sku: sku.trim().toUpperCase(), activo: true });
  if (!servicio) throw invalido(`No existe el servicio ${sku} en el catálogo: consulte consultar_servicios`);
  return servicio;
}

// Crea o actualiza por SKU.
export async function registrarServicio(datos: z.infer<typeof servicioDto>) {
  const repo = (await bd()).getRepository(Servicio);
  const existente = await repo.findOneBy({ sku: datos.sku });
  return aServicio(await repo.save({ ...(existente ?? {}), ...datos }));
}
