import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Orden } from '../ordenes/orden.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Tarea } from './tarea.entity';

export const ESTADOS_DIAGNOSTICO = ['borrador', 'finalizado', 'cancelado'] as const;
export type EstadoDiagnostico = (typeof ESTADOS_DIAGNOSTICO)[number];

// Un diagnóstico por orden. Si la orden se remite, el especialista sigue el mismo
// borrador: la revisión general queda como paso fijo.
@Entity('diagnosticos')
export class Diagnostico {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @OneToOne(() => Orden, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: Relation<Orden>;

  @ManyToOne(() => Usuario, { nullable: false, eager: true })
  @JoinColumn({ name: 'mecanico_id' })
  mecanico: Relation<Usuario>;

  @Column({ type: 'text', default: '' })
  observaciones: string;

  @Column({ type: 'enum', enum: ESTADOS_DIAGNOSTICO, default: 'borrador' })
  estado: EstadoDiagnostico;

  @OneToMany(() => Tarea, (t) => t.diagnostico, { cascade: true })
  tareas: Relation<Tarea[]>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'finalizado_en', type: 'timestamptz', nullable: true })
  finalizadoEn: Date | null;
}
