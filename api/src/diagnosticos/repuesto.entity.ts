import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { numerico } from '../comun/columnas';
import { Item } from '../inventario/item.entity';
import { Tarea } from './tarea.entity';

// Pieza que necesita una tarea. Sin ítem es una pieza que el taller no tiene en
// inventario: se le pide al proyecto de partes.
@Entity('diagnostico_repuestos')
export class Repuesto {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Tarea, (t) => t.repuestos, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tarea_id' })
  tarea: Relation<Tarea>;

  @ManyToOne(() => Item, { nullable: true, eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Relation<Item> | null;

  @Column({ type: 'varchar', length: 160 })
  descripcion: string;

  @Column({ type: 'integer' })
  cantidad: number;

  @Column({ name: 'precio_unitario', type: 'numeric', precision: 12, scale: 2, transformer: numerico })
  precioUnitario: number;
}
