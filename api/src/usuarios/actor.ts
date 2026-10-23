import type { Usuario } from './usuario.entity';

// Quien hace la petición, tal como queda después de validar el token.
export interface Actor {
  id: string;
  nombre: string;
  apellido: string;
  usuario: string;
  rol: string;
}

export const aActor = (u: Usuario): Actor => ({
  id: u.id,
  nombre: u.nombre,
  apellido: u.apellido,
  usuario: u.usuario,
  rol: u.rol.nombre,
});

export const tiene = (actor: Actor, roles: readonly string[]) =>
  roles.includes(actor.rol);
