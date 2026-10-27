import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { numerico } from '../comun/columnas';
import { Orden } from '../ordenes/orden.entity';
import { ParteUsada } from './parte-usada.entity';
import { RegistroHoras } from './registro-horas.entity';

export const ESTADOS_REPARACION = ['en_curso', 'terminada', 'cancelada'] as const;
export type EstadoReparacion = (typeof ESTADOS_REPARACION)[number];

@Entity('reparaciones')
export class Reparacion {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @OneToOne(() => Orden, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: Relation<Orden>;

  @Column({ type: 'enum', enum: ESTADOS_REPARACION, default: 'en_curso' })
  estado: EstadoReparacion;

  @Column({ name: 'iniciada_en', type: 'timestamptz', default: () => 'now()' })
  iniciadaEn: Date;

  @Column({ name: 'terminada_en', type: 'timestamptz', nullable: true })
  terminadaEn: Date | null;

  // Mano de obra de los servicios hechos (Σ precio de sus SKU), fijada al terminar.
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: numerico,
  })
  total: number | null;

  @OneToMany(() => RegistroHoras, (h) => h.reparacion)
  horas: Relation<RegistroHoras[]>;

  @OneToMany(() => ParteUsada, (p) => p.reparacion)
  partes: Relation<ParteUsada[]>;
}
