import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { Orden } from './orden.entity';
import { ETAPAS } from './reglas';
import type { Etapa } from './reglas';

// Un mecánico asignado a una orden para una etapa. Puede haber varios por orden.
@Entity('asignaciones')
export class Asignacion {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Orden, (o) => o.asignaciones, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: Relation<Orden>;

  @ManyToOne(() => Usuario, { nullable: false, eager: true })
  @JoinColumn({ name: 'mecanico_id' })
  mecanico: Relation<Usuario>;

  @Column({ type: 'enum', enum: ETAPAS })
  etapa: Etapa;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'asignado_por' })
  asignadoPor: Relation<Usuario>;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
