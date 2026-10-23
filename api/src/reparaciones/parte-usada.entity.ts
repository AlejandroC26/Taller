import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { numerico } from '../comun/columnas';
import { Item } from '../inventario/item.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Reparacion } from './reparacion.entity';

// Pieza que salió del inventario para esta reparación.
@Entity('partes_usadas')
export class ParteUsada {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Reparacion, (r) => r.partes, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reparacion_id' })
  reparacion: Relation<Reparacion>;

  @ManyToOne(() => Item, { nullable: false, eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Relation<Item>;

  @Column({ type: 'integer' })
  cantidad: number;

  // Precio del ítem en el momento de usarlo.
  @Column({ name: 'precio_unitario', type: 'numeric', precision: 12, scale: 2, transformer: numerico })
  precioUnitario: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'registrada_por' })
  registradaPor: Relation<Usuario>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
