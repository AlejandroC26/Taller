import { bd } from '../base-datos/conexion';
import { conflicto, invalido, noAutorizado, noEncontrado } from '../comun/errores';
import { aActor } from './actor';
import type { Actor } from './actor';
import { cifrarClave, claveCorrecta } from './claves';
import type { EditarUsuario, NuevoUsuario } from './dto';
import { Rol } from './rol.entity';
import { emitir, verificar } from './tokens';
import type { Audiencia } from './tokens';
import { Usuario } from './usuario.entity';

// Huella de relleno: si el usuario no existe, se compara igual para no revelarlo por
// el tiempo de respuesta.
let relleno: Promise<string> | undefined;
const huellaRelleno = () => (relleno ??= cifrarClave('relleno-para-comparar'));

export async function entrar(usuario: string, clave: string) {
  const db = await bd();
  const encontrado = await db
    .getRepository(Usuario)
    .createQueryBuilder('u')
    .addSelect('u.claveHash')
    .leftJoinAndSelect('u.rol', 'rol')
    .where('u.usuario = :usuario', { usuario: usuario.trim().toLowerCase() })
    .getOne();
  const valida = await claveCorrecta(clave, encontrado?.claveHash ?? (await huellaRelleno()));
  // El mismo mensaje para usuario inexistente y clave errada.
  if (!encontrado || !valida) throw noAutorizado('Usuario o clave incorrectos');
  if (!encontrado.activo) throw noAutorizado('La cuenta está desactivada');
  return { token: await emitir(encontrado.id, 'web'), usuario: aActor(encontrado) };
}

// Valida el token y trae al usuario de la base: si cambió su rol o lo desactivaron,
// se nota de inmediato.
export async function actorDelToken(
  token: string | undefined,
  audiencia: Audiencia,
): Promise<Actor> {
  const id = await verificar(token, audiencia);
  const usuario = await (await bd()).getRepository(Usuario).findOneBy({ id });
  if (!usuario) throw noAutorizado('La cuenta ya no existe');
  if (!usuario.activo) throw noAutorizado('La cuenta está desactivada');
  return aActor(usuario);
}

export const tokenMcp = (actor: Actor) => emitir(actor.id, 'mcp');

const aRespuesta = (u: Usuario) => ({
  id: u.id,
  nombre: u.nombre,
  apellido: u.apellido,
  documento: u.documento,
  telefono: u.telefono,
  usuario: u.usuario,
  rol: u.rol.nombre,
  activo: u.activo,
  creadoEn: u.creadoEn,
});

export async function listarUsuarios(rol?: string) {
  const lista = await (await bd()).getRepository(Usuario).find({
    where: rol ? { rol: { nombre: rol } } : {},
    order: { nombre: 'ASC', apellido: 'ASC' },
  });
  return lista.map(aRespuesta);
}

async function buscarRol(nombre: string): Promise<Rol> {
  const rol = await (await bd()).getRepository(Rol).findOneBy({ nombre });
  if (!rol) throw invalido(`No existe el rol ${nombre}`);
  return rol;
}

async function exigirUnico(datos: { documento?: string; usuario?: string }, salvo?: string) {
  const repo = (await bd()).getRepository(Usuario);
  for (const campo of ['documento', 'usuario'] as const) {
    const valor = datos[campo];
    if (!valor) continue;
    const otro = await repo.findOneBy({ [campo]: valor });
    if (otro && otro.id !== salvo) throw conflicto(`Ya existe un usuario con ese ${campo}`);
  }
}

export async function crearUsuario(datos: NuevoUsuario) {
  await exigirUnico(datos);
  const repo = (await bd()).getRepository(Usuario);
  const usuario = await repo.save(
    repo.create({
      nombre: datos.nombre,
      apellido: datos.apellido,
      documento: datos.documento,
      telefono: datos.telefono,
      usuario: datos.usuario,
      claveHash: await cifrarClave(datos.clave),
      rol: await buscarRol(datos.rol),
    }),
  );
  return aRespuesta(usuario);
}

export async function editarUsuario(id: string, datos: EditarUsuario, actor: Actor) {
  const repo = (await bd()).getRepository(Usuario);
  const usuario = await repo.findOneBy({ id });
  if (!usuario) throw noEncontrado('No existe ese usuario');
  // Un administrador no puede quitarse a sí mismo el acceso.
  if (id === actor.id && (datos.activo === false || (datos.rol && datos.rol !== actor.rol))) {
    throw invalido('No puede desactivar su propia cuenta ni cambiar su propio rol');
  }
  await exigirUnico({ documento: datos.documento }, id);
  const { clave, rol, ...resto } = datos;
  Object.assign(usuario, resto);
  if (rol) usuario.rol = await buscarRol(rol);
  if (clave) usuario.claveHash = await cifrarClave(clave);
  return aRespuesta(await repo.save(usuario));
}

export async function listarRoles() {
  const db = await bd();
  const roles = await db.getRepository(Rol).find({ order: { id: 'ASC' } });
  const conteo: { rol_id: number; total: string }[] = await db.query(
    'SELECT rol_id, count(*) AS total FROM usuarios GROUP BY rol_id',
  );
  return roles.map((r) => ({
    ...r,
    usuarios: Number(conteo.find((c) => c.rol_id === r.id)?.total ?? 0),
  }));
}

// Los roles son fijos (los crea la semilla) porque los permisos del código dependen de
// su nombre: solo se edita la descripción.
export async function editarRol(id: number, descripcion: string) {
  const repo = (await bd()).getRepository(Rol);
  const rol = await repo.findOneBy({ id });
  if (!rol) throw noEncontrado('No existe ese rol');
  rol.descripcion = descripcion;
  return repo.save(rol);
}
