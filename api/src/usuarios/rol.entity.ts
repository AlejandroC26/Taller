import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Los roles son datos (nombre y descripción), pero los permisos del código se revisan
// por el nombre de estos roles del sistema, que no se pueden borrar.
export const ROLES_SISTEMA = [
  'administrador',
  'recepcionista',
  'mecanico',
  'concesionario',
] as const;
export type RolSistema = (typeof ROLES_SISTEMA)[number];

// Grupos que usan las rutas y el MCP.
export const PERSONAL: readonly string[] = ['administrador', 'recepcionista'];
export const TALLER: readonly string[] = ['administrador', 'recepcionista', 'mecanico'];
export const SOLO_ADMIN: readonly string[] = ['administrador'];

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  descripcion: string;
}
