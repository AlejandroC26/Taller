import type { Usuario } from './usuario.entity';

// Quien hace la petición, tal como queda después de validar el token. tallerId es la sede
// del mecánico (null para el administrador y los agentes).
export interface Actor {
  id: string;
  nombre: string;
  apellido: string;
  usuario: string;
  rol: string;
  tallerId: number | null;
}

export const aActor = (u: Usuario): Actor => ({
  id: u.id,
  nombre: u.nombre,
  apellido: u.apellido,
  usuario: u.usuario,
  rol: u.rol.nombre,
  tallerId: u.taller?.id ?? null,
});

export const tiene = (actor: Actor, roles: readonly string[]) => roles.includes(actor.rol);
