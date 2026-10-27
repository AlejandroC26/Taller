import { In } from 'typeorm';
import { z } from 'zod';
import { bd } from '../base-datos/conexion';
import { conflicto, noEncontrado } from '../comun/errores';
import { Orden } from '../ordenes/orden.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { ESPECIALIDADES, franjas, TIPOS_TALLER, ZONA } from './reglas';
import type { Especialidad } from './reglas';
import { Taller } from './taller.entity';

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)');

export const tallerDto = z.object({
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, 'Código inválido'),
  nombre: z.string().trim().min(3).max(120),
  tipo: z.enum(TIPOS_TALLER),
  especialidades: z.array(z.enum(ESPECIALIDADES)).min(1, 'Indique al menos una especialidad'),
  ciudad: z.string().trim().min(2).max(60),
  direccion: z.string().trim().min(3).max(200),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
  telefono: z.string().trim().max(30).default(''),
  horario: z.object({ dias: z.array(z.number().int().min(1).max(7)).min(1), apertura: hora, cierre: hora }),
});
export const editarTallerDto = tallerDto.omit({ codigo: true }).partial().extend({ activo: z.boolean().optional() });

export const aTaller = (t: Taller) => ({
  id: t.id,
  codigo: t.codigo,
  nombre: t.nombre,
  tipo: t.tipo,
  especialidades: t.especialidades,
  ubicacion: { ciudad: t.ciudad, direccion: t.direccion, latitud: t.latitud, longitud: t.longitud },
  telefono: t.telefono,
  horario: t.horario,
  activo: t.activo,
});

export async function listarTalleres(filtro: { especialidad?: Especialidad; ciudad?: string; incluirInactivos?: boolean } = {}) {
  const lista = await (await bd()).getRepository(Taller).find({ order: { tipo: 'ASC', id: 'ASC' } });
  return lista
    .filter((t) => filtro.incluirInactivos || t.activo)
    .filter((t) => !filtro.especialidad || t.especialidades.includes(filtro.especialidad))
    .filter((t) => !filtro.ciudad || t.ciudad.toLowerCase() === filtro.ciudad.trim().toLowerCase())
    .map(aTaller);
}

export async function buscarTaller(idOCodigo: number | string): Promise<Taller> {
  const repo = (await bd()).getRepository(Taller);
  const taller =
    typeof idOCodigo === 'number' ? await repo.findOneBy({ id: idOCodigo }) : await repo.findOneBy({ codigo: idOCodigo.toUpperCase() });
  if (!taller) throw noEncontrado(`No existe la sede ${idOCodigo}`);
  return taller;
}

export async function registrarTaller(datos: z.infer<typeof tallerDto>) {
  const repo = (await bd()).getRepository(Taller);
  if (await repo.existsBy({ codigo: datos.codigo })) throw conflicto(`Ya existe una sede con el código ${datos.codigo}`);
  return aTaller(await repo.save(repo.create(datos)));
}

export async function actualizarTaller(idOCodigo: number | string, datos: z.infer<typeof editarTallerDto>) {
  const taller = await buscarTaller(idOCodigo);
  Object.assign(taller, datos);
  return aTaller(await (await bd()).getRepository(Taller).save(taller));
}

// Franjas libres de una sede en una fecha: el cupo es el número de mecánicos activos.
export async function disponibilidad(idOCodigo: number | string, fecha: string) {
  const db = await bd();
  const taller = await buscarTaller(idOCodigo);
  const mecanicos = await db.getRepository(Usuario).count({
    where: { taller: { id: taller.id }, activo: true, rol: { nombre: 'mecanico' } },
  });
  const desde = new Date(`${fecha}T00:00:00${ZONA}`);
  const hasta = new Date(desde.getTime() + 86_400_000);
  const citas = await db
    .getRepository(Orden)
    .createQueryBuilder('o')
    .where('o.taller_id = :t', { t: taller.id })
    .andWhere('o.fecha_cita >= :desde AND o.fecha_cita < :hasta', { desde, hasta })
    .andWhere('o.estado NOT IN (:...cerradas)', { cerradas: ['cancelada'] })
    .getMany();
  return {
    taller: aTaller(taller),
    fecha,
    cupo_por_franja: Math.max(1, mecanicos),
    franjas: franjas(taller.horario, fecha, citas.map((c) => c.fechaCita!.toISOString()), mecanicos),
  };
}

export async function talleresPorIds(ids: number[]) {
  return (await bd()).getRepository(Taller).findBy({ id: In(ids) });
}
