import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bd } from '../base-datos/conexion';
import { RAIZ } from '../config';
import { invalido, noEncontrado } from '../comun/errores';
import { asignadoA, cargarOrden } from '../ordenes/ordenes.service';
import { codigoOrden, exigirTrabajo } from '../ordenes/reglas';
import type { Actor } from '../usuarios/actor';
import { Evidencia } from './evidencia.entity';
import { nombreSeguro, TIPOS_EVIDENCIA, validarEvidencia } from './reglas';
import { Tarea } from './tarea.entity';

// Los archivos viven fuera del repositorio; la base solo guarda sus datos.
export const CARPETA_EVIDENCIAS = join(RAIZ, 'almacen', 'evidencias');

// Dirección con la que otros agentes (el concesionario) descargan la evidencia.
export const urlEvidencia = (id: number) =>
  `${process.env.TALLER_URL_PUBLICA ?? 'http://localhost:3417'}/api/evidencias/${id}`;

const aEvidencia = (e: Evidencia) => ({
  id: e.id,
  orden: codigoOrden(e.orden.id),
  tarea_id: e.tarea?.id ?? null,
  nombre: e.nombre,
  tipo: e.tipo,
  tamano: e.tamano,
  url: urlEvidencia(e.id),
  creado_en: e.creadoEn,
});

// La adjunta el mecánico mientras diagnostica (o la gestión).
export async function guardarEvidencia(
  actor: Actor,
  codigo: string,
  archivo: { nombre: string; datos: Uint8Array; tareaId?: number },
) {
  const tipo = validarEvidencia(archivo.datos);
  const db = await bd();
  const orden = await cargarOrden(db.manager, actor, codigo);
  exigirTrabajo(actor.rol, asignadoA(orden, actor, 'diagnostico'), 'diagnostico');
  if (orden.estado !== 'en_diagnostico') throw invalido(`La orden ${codigo} está ${orden.estado}: ya no recibe evidencias`);
  let tarea: Tarea | null = null;
  if (archivo.tareaId) {
    tarea = await db.getRepository(Tarea).findOne({ where: { id: archivo.tareaId, diagnostico: { orden: { id: orden.id } } } });
    if (!tarea) throw invalido('Ese servicio no pertenece al diagnóstico de la orden: guarde el borrador primero');
  }
  await mkdir(CARPETA_EVIDENCIAS, { recursive: true });
  const ruta = `${randomUUID()}.${TIPOS_EVIDENCIA[tipo]}`;
  await writeFile(join(CARPETA_EVIDENCIAS, ruta), archivo.datos);
  const repo = db.getRepository(Evidencia);
  const evidencia = await repo.save(
    repo.create({ orden, tarea, nombre: nombreSeguro(archivo.nombre), tipo, ruta, tamano: archivo.datos.length, subidaPor: { id: actor.id } }),
  );
  return aEvidencia(evidencia);
}

export async function listarEvidencias(actor: Actor, codigo: string) {
  const db = await bd();
  const orden = await cargarOrden(db.manager, actor, codigo);
  const lista = await db.getRepository(Evidencia).find({ where: { orden: { id: orden.id } }, relations: { orden: true, tarea: true }, order: { id: 'ASC' } });
  return lista.map(aEvidencia);
}

// Descarga: solo quien puede ver la orden.
export async function leerEvidencia(actor: Actor, id: number) {
  const db = await bd();
  const evidencia = await db.getRepository(Evidencia).findOne({ where: { id }, relations: { orden: true } });
  if (!evidencia) throw noEncontrado('No existe esa evidencia');
  await cargarOrden(db.manager, actor, codigoOrden(evidencia.orden.id));
  return { nombre: evidencia.nombre, tipo: evidencia.tipo, datos: await readFile(join(CARPETA_EVIDENCIAS, evidencia.ruta)) };
}
