import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { numerico } from '../comun/columnas';
import { Diagnostico } from './diagnostico.entity';
import { Repuesto } from './repuesto.entity';

// Un paso de la reparación: qué hacer, cuánto tarda y qué piezas necesita.
@Entity('diagnostico_tareas')
export class Tarea {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Diagnostico, (d) => d.tareas, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diagnostico_id' })
  diagnostico: Relation<Diagnostico>;

  @Column({ type: 'integer' })
  posicion: number;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ name: 'horas_estimadas', type: 'numeric', precision: 6, scale: 2, transformer: numerico })
  horasEstimadas: number;

  // Precio fijo del servicio, aparte de la mano de obra por horas.
  @Column({
    name: 'valor_servicio',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numerico,
  })
  valorServicio: number;

  @Column({ name: 'requiere_piezas', type: 'boolean', default: false })
  requierePiezas: boolean;

  @Column({ type: 'boolean', default: false })
  completada: boolean;

  @OneToMany(() => Repuesto, (r) => r.tarea, { cascade: true })
  repuestos: Relation<Repuesto[]>;
}
