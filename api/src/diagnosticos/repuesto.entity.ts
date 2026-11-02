import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Tarea } from './tarea.entity';

// Repuesto que hay que comprar para un servicio. El mecánico lo eligió del catálogo de la
// tienda por su código universal (el mismo en todas las tiendas). Sin precio ni marca: la
// tienda elige la marca y facturación consigue el precio.
@Entity('diagnostico_repuestos')
export class Repuesto {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Tarea, (t) => t.repuestos, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tarea_id' })
  tarea: Relation<Tarea>;

  // Código universal, por ejemplo PAS-DEL-CER.
  @Column({ name: 'codigo_repuesto', type: 'varchar', length: 50 })
  codigoRepuesto: string;

  @Column({ type: 'varchar', length: 200 })
  descripcion: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  categoria: string;

  @Column({ type: 'integer' })
  cantidad: number;
}
