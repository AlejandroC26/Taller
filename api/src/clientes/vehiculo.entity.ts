import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Cliente } from './cliente.entity';

// 'concesionario': el carro llegó enviado por el sistema del concesionario.
export const ORIGENES = ['taller', 'concesionario'] as const;
export type Origen = (typeof ORIGENES)[number];

@Entity('vehiculos')
export class Vehiculo {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  // Siempre en mayúsculas y sin espacios: ABC123.
  @Column({ type: 'varchar', length: 10, unique: true })
  placa: string;

  @Column({ type: 'varchar', length: 40 })
  marca: string;

  @Column({ type: 'varchar', length: 60 })
  modelo: string;

  @Column({ type: 'integer' })
  anio: number;

  @Column({ type: 'varchar', length: 30, default: '' })
  color: string;

  @Column({ type: 'integer', default: 0 })
  kilometraje: number;

  @ManyToOne(() => Cliente, (c) => c.vehiculos, { nullable: false })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Relation<Cliente>;

  @Column({ type: 'enum', enum: ORIGENES, default: 'taller' })
  origen: Origen;

  // Identificador del vehículo en el sistema que lo envió (concesionario).
  @Column({
    name: 'referencia_externa',
    type: 'varchar',
    length: 80,
    nullable: true,
    unique: true,
  })
  referenciaExterna: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
