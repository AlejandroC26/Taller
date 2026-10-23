import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Rol } from './rol.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  nombre: string;

  @Column({ type: 'varchar', length: 80 })
  apellido: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  documento: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  // Nombre con el que inicia sesión.
  @Column({ type: 'varchar', length: 40, unique: true })
  usuario: string;

  // Nunca se guarda la clave: solo su huella. select: false evita que salga en las
  // consultas.
  @Column({ name: 'clave_hash', type: 'varchar', length: 200, select: false })
  claveHash: string;

  @ManyToOne(() => Rol, { nullable: false, eager: true })
  @JoinColumn({ name: 'rol_id' })
  rol: Relation<Rol>;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
