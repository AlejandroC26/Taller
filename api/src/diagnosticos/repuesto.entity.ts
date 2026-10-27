import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Tarea } from './tarea.entity';

// Repuesto que hay que comprar para un servicio. Solo el código universal (el mismo en
// todas las tiendas) y la cantidad: el precio lo consigue facturación con las tiendas.
@Entity('diagnostico_repuestos')
export class Repuesto {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Tarea, (t) => t.repuestos, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tarea_id' })
  tarea: Relation<Tarea>;

  @Column({ name: 'codigo_repuesto', type: 'varchar', length: 40 })
  codigoRepuesto: string;

  @Column({ type: 'varchar', length: 160 })
  descripcion: string;

  @Column({ type: 'integer' })
  cantidad: number;
}
