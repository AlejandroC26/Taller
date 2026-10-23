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
import { numerico } from '../comun/columnas';
import { Orden } from '../ordenes/orden.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Tarea } from './tarea.entity';

export const ESTADOS_DIAGNOSTICO = ['borrador', 'finalizado', 'cancelado'] as const;
export type EstadoDiagnostico = (typeof ESTADOS_DIAGNOSTICO)[number];

// Un diagnóstico por orden: el paso a paso de la reparación y su costo estimado.
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

  // Copia de la tarifa al crear el diagnóstico: si la tarifa cambia, no altera lo
  // cotizado.
  @Column({ name: 'tarifa_hora', type: 'numeric', precision: 12, scale: 2, transformer: numerico })
  tarifaHora: number;

  @Column({ type: 'enum', enum: ESTADOS_DIAGNOSTICO, default: 'borrador' })
  estado: EstadoDiagnostico;

  @OneToMany(() => Tarea, (t) => t.diagnostico, { cascade: true })
  tareas: Relation<Tarea[]>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'finalizado_en', type: 'timestamptz', nullable: true })
  finalizadoEn: Date | null;
}
