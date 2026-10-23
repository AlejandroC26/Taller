import type { EntityManager } from 'typeorm';
import { bd } from '../base-datos/conexion';
import { conflicto, invalido, noEncontrado } from '../comun/errores';
import type { Actor } from '../usuarios/actor';
import { Categoria } from './categoria.entity';
import type { DatosItem, DatosMovimiento, EditarItem } from './dto';
import { Item } from './item.entity';
import { Movimiento } from './movimiento.entity';
import type { TipoMovimiento } from './movimiento.entity';
import { aplicarMovimiento, enAlerta } from './reglas';

export const aItem = (i: Item) => ({
  id: i.id,
  codigo: i.codigo,
  nombre: i.nombre,
  precio: i.precio,
  cantidad: i.cantidad,
  nivelAlerta: i.nivelAlerta,
  categoria: i.categoria?.nombre,
  categoriaId: i.categoria?.id,
  activo: i.activo,
  enAlerta: enAlerta(i),
});

export interface FiltroInventario {
  texto?: string;
  soloAlertas?: boolean;
  categoriaId?: number;
}

export async function listarItems(filtro: FiltroInventario = {}) {
  const consulta = (await bd())
    .getRepository(Item)
    .createQueryBuilder('i')
    .leftJoinAndSelect('i.categoria', 'c')
    .where('i.activo = true')
    .orderBy('c.nombre', 'ASC')
    .addOrderBy('i.nombre', 'ASC');
  if (filtro.texto?.trim()) {
    consulta.andWhere('(i.nombre ILIKE :t OR i.codigo ILIKE :t)', { t: `%${filtro.texto.trim()}%` });
  }
  if (filtro.soloAlertas) consulta.andWhere('i.cantidad <= i.nivel_alerta');
  if (filtro.categoriaId) consulta.andWhere('c.id = :c', { c: filtro.categoriaId });
  return (await consulta.getMany()).map(aItem);
}

export async function unItem(id: number) {
  const item = await (await bd()).getRepository(Item).findOneBy({ id });
  if (!item) throw noEncontrado('No existe ese ítem');
  return aItem(item);
}

async function categoria(gestor: EntityManager, id: number) {
  const encontrada = await gestor.findOneBy(Categoria, { id });
  if (!encontrada) throw invalido('No existe esa categoría');
  return encontrada;
}

export async function crearItem(datos: DatosItem, actor: Actor) {
  const db = await bd();
  const id = await db.transaction(async (tx) => {
    if (await tx.existsBy(Item, { codigo: datos.codigo })) {
      throw conflicto(`Ya existe un ítem con el código ${datos.codigo}`);
    }
    const { categoriaId, cantidad, ...resto } = datos;
    const item = await tx.save(
      tx.create(Item, { ...resto, cantidad: 0, categoria: await categoria(tx, categoriaId) }),
    );
    // Las existencias iniciales entran como un movimiento, para que quede el rastro.
    if (cantidad > 0) await moverExistencias(tx, item.id, 'entrada', cantidad, actor, { nota: 'Existencias iniciales' });
    return item.id;
  });
  return unItem(id);
}

export async function editarItem(id: number, datos: EditarItem) {
  const db = await bd();
  const item = await db.getRepository(Item).findOneBy({ id });
  if (!item) throw noEncontrado('No existe ese ítem');
  const { categoriaId, ...resto } = datos;
  Object.assign(item, resto);
  if (categoriaId) item.categoria = await categoria(db.manager, categoriaId);
  await db.getRepository(Item).save(item);
  return unItem(id);
}

// Cambia las existencias dentro de una transacción. Bloquea la fila del ítem (FOR
// UPDATE) para que dos salidas al mismo tiempo no dejen el saldo en negativo.
export async function moverExistencias(
  tx: EntityManager,
  itemId: number,
  tipo: TipoMovimiento,
  cantidad: number,
  actor: Actor,
  { ordenId, nota = '' }: { ordenId?: number; nota?: string } = {},
) {
  const [fila]: { cantidad: number; nombre: string; precio: string }[] = await tx.query(
    'SELECT cantidad, nombre, precio FROM items WHERE id = $1 AND activo = true FOR UPDATE',
    [itemId],
  );
  if (!fila) throw noEncontrado('No existe ese ítem en el inventario');
  const { saldo, diferencia } = aplicarMovimiento(fila.cantidad, tipo, cantidad, fila.nombre);
  await tx.update(Item, itemId, { cantidad: saldo });
  await tx.save(
    tx.create(Movimiento, {
      item: { id: itemId },
      tipo,
      cantidad: diferencia,
      saldo,
      orden: ordenId ? { id: ordenId } : null,
      usuario: { id: actor.id },
      nota,
    }),
  );
  return { saldo, nombre: fila.nombre, precio: Number(fila.precio) };
}

export async function registrarMovimiento(id: number, datos: DatosMovimiento, actor: Actor) {
  await (await bd()).transaction((tx) =>
    moverExistencias(tx, id, datos.tipo, datos.cantidad, actor, { nota: datos.nota }),
  );
  return unItem(id);
}

export async function movimientos(id: number) {
  const lista = await (await bd()).getRepository(Movimiento).find({
    where: { item: { id } },
    relations: { usuario: true, orden: true },
    order: { id: 'DESC' },
    take: 50,
  });
  return lista.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    cantidad: m.cantidad,
    saldo: m.saldo,
    nota: m.nota,
    ordenId: m.orden?.id ?? null,
    usuario: `${m.usuario.nombre} ${m.usuario.apellido}`,
    fecha: m.creadoEn,
  }));
}

export async function listarCategorias() {
  return (await bd()).getRepository(Categoria).find({ order: { nombre: 'ASC' } });
}

export async function crearCategoria(nombre: string) {
  const repo = (await bd()).getRepository(Categoria);
  if (await repo.existsBy({ nombre })) throw conflicto('Ya existe esa categoría');
  return repo.save(repo.create({ nombre }));
}
