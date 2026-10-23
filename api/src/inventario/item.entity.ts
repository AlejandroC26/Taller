import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { numerico } from '../comun/columnas';
import { Categoria } from './categoria.entity';

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  // Referencia (SKU) con la que se habla con el proyecto de partes.
  @Column({ type: 'varchar', length: 40, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numerico })
  precio: number;

  @Column({ type: 'integer', default: 0 })
  cantidad: number;

  // Con cantidad <= nivel de alerta, el ítem aparece en las alertas.
  @Column({ name: 'nivel_alerta', type: 'integer', default: 0 })
  nivelAlerta: number;

  @ManyToOne(() => Categoria, { nullable: false, eager: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Relation<Categoria>;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
