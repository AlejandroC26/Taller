import { In } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import { bd } from '../base-datos/conexion';
import { conflicto, invalido, noEncontrado } from '../comun/errores';
import { Orden } from '../ordenes/orden.entity';
import { obtenerRelacion } from '../relaciones/relaciones.service';
import { Usuario } from '../usuarios/usuario.entity';
import {
  codigoReserva,
  diasDelRango,
  ESPECIALIDADES,
  exigirFecha,
  exigirFranjaLibre,
  fechaLocal,
  franjas,
  isoColombia,
  MINUTOS_RESERVA,
  numeroReserva,
  TIPOS_TALLER,
  ZONA,
} from './reglas';
import type { Especialidad } from './reglas';
import { ReservaFranja } from './reserva.entity';
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

// Cuántos cupos tiene cada franja: el número de mecánicos activos de la sede.
async function capacidad(gestor: EntityManager, tallerId: number) {
  return gestor.getRepository(Usuario).count({ where: { taller: { id: tallerId }, activo: true, rol: { nombre: 'mecanico' } } });
}

// Lo que ocupa cupo entre dos fechas: las citas no canceladas y las reservas vigentes.
// Las reservas del mismo vehículo no cuentan, así puede agendar en la hora que apartó.
async function ocupadas(gestor: EntityManager, tallerId: number, desde: Date, hasta: Date, exceptoRelacion?: string): Promise<string[]> {
  const citas = await gestor
    .getRepository(Orden)
    .createQueryBuilder('o')
    .where('o.taller_id = :t', { t: tallerId })
    .andWhere('o.fecha_cita >= :desde AND o.fecha_cita < :hasta', { desde, hasta })
    .andWhere('o.estado NOT IN (:...cerradas)', { cerradas: ['cancelada'] })
    .getMany();
  const consulta = gestor
    .getRepository(ReservaFranja)
    .createQueryBuilder('r')
    .where('r.taller_id = :t', { t: tallerId })
    .andWhere('r.fecha_hora >= :desde AND r.fecha_hora < :hasta', { desde, hasta })
    .andWhere('r.usada = false AND r.vence_en > now()');
  if (exceptoRelacion) consulta.andWhere('r.id_relacion <> :rel', { rel: exceptoRelacion });
  const reservas = await consulta.getMany();
  return [...citas.map((c) => c.fechaCita!.toISOString()), ...reservas.map((r) => r.fechaHora.toISOString())];
}

const inicioDelDia = (fecha: string) => new Date(`${fecha}T00:00:00${ZONA}`);

async function franjasDelDia(gestor: EntityManager, taller: Taller, fecha: string, exceptoRelacion?: string) {
  exigirFecha(fecha);
  const desde = inicioDelDia(fecha);
  const usadas = await ocupadas(gestor, taller.id, desde, new Date(desde.getTime() + 86_400_000), exceptoRelacion);
  const cupo = await capacidad(gestor, taller.id);
  return { cupo: Math.max(1, cupo), franjas: franjas(taller.horario, fecha, usadas, cupo) };
}

// Franjas de una sede en una fecha, con los cupos que quedan (también las llenas).
export async function disponibilidad(idOCodigo: number | string, fecha: string, exceptoRelacion?: string) {
  const taller = await buscarTaller(idOCodigo);
  const dia = await franjasDelDia((await bd()).manager, taller, fecha, exceptoRelacion);
  return { taller: aTaller(taller), fecha, cupo_por_franja: dia.cupo, franjas: dia.franjas };
}

// Solo las franjas libres entre dos fechas (hasta 14 días), en una consulta.
export async function disponibilidadRango(idOCodigo: number | string, desde: string, hasta: string) {
  const dias = diasDelRango(desde, hasta);
  const taller = await buscarTaller(idOCodigo);
  const gestor = (await bd()).manager;
  const inicio = inicioDelDia(dias[0]);
  const fin = new Date(inicioDelDia(dias[dias.length - 1]).getTime() + 86_400_000);
  const usadas = await ocupadas(gestor, taller.id, inicio, fin);
  const cupo = await capacidad(gestor, taller.id);
  const libres = dias.flatMap((fecha) => franjas(taller.horario, fecha, usadas, cupo)).filter((f) => f.libres > 0);
  return {
    taller: aTaller(taller),
    desde: dias[0],
    hasta: dias[dias.length - 1],
    cupo_por_franja: Math.max(1, cupo),
    franjas: libres,
    total: libres.length,
    siguiente_paso: {
      responsable: 'concesionario',
      descripcion: libres.length
        ? 'Ofrézcale las horas al cliente; aparte la que elija con reservar_franja mientras confirma'
        : 'No hay franjas libres en ese rango: consulte otras fechas',
    },
    acciones_disponibles: libres.length ? ['reservar_franja', 'agendar_cita'] : ['consultar_disponibilidad'],
  };
}

export const reservaDto = z.object({
  idRelacion: z.string().trim().min(1, 'Falta el id_relacion'),
  taller: z.union([z.number().int().positive(), z.string().trim().min(2)]),
  fechaHora: z.iso.datetime({ offset: true, message: 'Fecha y hora ISO 8601 con zona; por ejemplo 2026-11-05T09:00:00-05:00' }),
});

// Aparta una franja por 10 minutos para un vehículo. Si ese vehículo ya tenía otra hora
// apartada, se libera: un vehículo tiene a lo sumo una reserva vigente.
export async function reservarFranja(datos: z.infer<typeof reservaDto>) {
  const relacion = await obtenerRelacion(datos.idRelacion);
  const taller = await buscarTaller(datos.taller);
  if (!taller.activo) throw invalido(`La sede ${taller.nombre} no está activa`);
  const reserva = await (await bd()).transaction(async (tx) => {
    // Se bloquea la sede para que dos reservas no se lleven el último cupo a la vez.
    await tx.getRepository(Taller).createQueryBuilder('t').setLock('pessimistic_write').where('t.id = :id', { id: taller.id }).getOne();
    const dia = await franjasDelDia(tx, taller, fechaLocal(datos.fechaHora), relacion.idRelacion);
    exigirFranjaLibre(dia.franjas, datos.fechaHora);
    await tx
      .createQueryBuilder()
      .update(ReservaFranja)
      .set({ usada: true })
      .where('id_relacion = :rel AND usada = false', { rel: relacion.idRelacion })
      .execute();
    return tx.save(
      tx.create(ReservaFranja, {
        taller,
        relacion,
        fechaHora: new Date(datos.fechaHora),
        venceEn: new Date(Date.now() + MINUTOS_RESERVA * 60_000),
      }),
    );
  });
  return {
    id_reserva: codigoReserva(reserva.id),
    id_relacion: relacion.idRelacion,
    taller: aTaller(taller),
    fecha_hora: isoColombia(reserva.fechaHora),
    vence_en: isoColombia(reserva.venceEn),
    minutos_vigencia: MINUTOS_RESERVA,
    siguiente_paso: {
      responsable: 'concesionario',
      descripcion: `Confirme la hora con el cliente y agende con agendar_cita enviando id_reserva (y id_prediagnostico) antes de ${MINUTOS_RESERVA} minutos`,
    },
    acciones_disponibles: ['agendar_cita', 'reservar_franja'],
  };
}

// La reserva con la que se va a agendar. Una vencida ya no aparta nada, pero se puede
// agendar igual si la franja sigue libre; una usada no.
export async function reservaParaAgendar(codigo: string, idRelacion: string, gestor?: EntityManager): Promise<ReservaFranja> {
  const id = numeroReserva(codigo);
  const reserva = id ? await (gestor ?? (await bd()).manager).findOne(ReservaFranja, { where: { id }, relations: { taller: true, relacion: true } }) : null;
  if (!reserva) throw noEncontrado(`No existe la reserva ${codigo}`);
  if (reserva.relacion.idRelacion !== idRelacion) throw invalido(`La reserva ${codigoReserva(reserva.id)} es de otro id_relacion`);
  if (reserva.usada) throw conflicto(`La reserva ${codigoReserva(reserva.id)} ya no está vigente: aparte la hora de nuevo con reservar_franja`);
  return reserva;
}

export async function talleresPorIds(ids: number[]) {
  return (await bd()).getRepository(Taller).findBy({ id: In(ids) });
}
