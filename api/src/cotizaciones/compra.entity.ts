import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { numerico } from '../comun/columnas';
import { PAGADORES } from '../garantias/reglas';
import type { Pagador } from '../garantias/reglas';
import { Orden } from '../ordenes/orden.entity';

// Una línea de la orden de compra que armó facturación con las tiendas. Es informativa:
// el taller sabe qué repuesto llega, de qué tienda y quién lo paga.
@Entity('compras_repuestos')
export class CompraRepuesto {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Orden, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: Relation<Orden>;

  // Código universal, el mismo de la cotización.
  @Column({ name: 'codigo_repuesto', type: 'varchar', length: 50 })
  codigoRepuesto: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  descripcion: string;

  @Column({ type: 'integer' })
  cantidad: number;

  @Column({ type: 'varchar', length: 120 })
  tienda: string;

  @Column({ name: 'precio_unitario', type: 'numeric', precision: 12, scale: 2, transformer: numerico })
  precioUnitario: number;

  @Column({ type: 'enum', enum: PAGADORES, default: 'cliente' })
  pagador: Pagador;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
