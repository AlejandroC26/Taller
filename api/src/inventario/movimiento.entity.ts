import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Orden } from '../ordenes/orden.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Item } from './item.entity';

export const TIPOS_MOVIMIENTO = ['entrada', 'salida', 'ajuste'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

// Cada cambio de existencias deja un rastro: quién, cuánto y por qué orden.
@Entity('movimientos_inventario')
export class Movimiento {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Item, { nullable: false })
  @JoinColumn({ name: 'item_id' })
  item: Relation<Item>;

  @Column({ type: 'enum', enum: TIPOS_MOVIMIENTO })
  tipo: TipoMovimiento;

  // Positivo en entradas, negativo en salidas; en un ajuste, la diferencia.
  @Column({ type: 'integer' })
  cantidad: number;

  // Existencias del ítem después del movimiento.
  @Column({ type: 'integer' })
  saldo: number;

  @ManyToOne(() => Orden, { nullable: true })
  @JoinColumn({ name: 'orden_id' })
  orden: Relation<Orden> | null;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Relation<Usuario>;

  @Column({ type: 'varchar', length: 200, default: '' })
  nota: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
