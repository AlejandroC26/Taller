import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Los roles son datos (nombre y descripción), pero los permisos del código se revisan
// por el nombre de estos roles del sistema, que no se pueden borrar.
//   agente: rol técnico de los agentes externos y orquestadores (concesionario,
//   facturación…). Ve todas las herramientas del MCP.
export const ROLES_SISTEMA = ['administrador', 'mecanico', 'agente'] as const;
export type RolSistema = (typeof ROLES_SISTEMA)[number];

// Grupos que usan las rutas y el MCP.
export const GESTION: readonly string[] = ['administrador', 'agente'];
export const TALLER: readonly string[] = ['administrador', 'agente', 'mecanico'];
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
