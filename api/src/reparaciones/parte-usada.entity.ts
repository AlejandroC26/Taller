import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { CompraRepuesto } from '../cotizaciones/compra.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Reparacion } from './reparacion.entity';

// Registro de lo que el mecánico usó y gastó. El taller no tiene inventario: esto solo
// deja constancia (y se reporta a facturación al terminar).
@Entity('partes_usadas')
export class ParteUsada {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Reparacion, (r) => r.partes, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reparacion_id' })
  reparacion: Relation<Reparacion>;

  @Column({ name: 'codigo_repuesto', type: 'varchar', length: 40 })
  codigoRepuesto: string;

  @Column({ type: 'varchar', length: 160, default: '' })
  descripcion: string;

  @Column({ type: 'integer' })
  cantidad: number;

  // La línea de la orden de compra de la que salió, si aplica.
  @ManyToOne(() => CompraRepuesto, { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'compra_id' })
  compra: Relation<CompraRepuesto> | null;

  @Column({ type: 'varchar', length: 300, default: '' })
  nota: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'registrada_por' })
  registradaPor: Relation<Usuario>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
