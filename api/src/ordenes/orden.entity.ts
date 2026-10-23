import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ORIGENES, Vehiculo } from '../clientes/vehiculo.entity';
import type { Origen } from '../clientes/vehiculo.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Asignacion } from './asignacion.entity';
import { ESTADOS } from './reglas';
import type { Estado, PasoHistorial } from './reglas';

@Entity('ordenes')
export class Orden {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Vehiculo, { nullable: false })
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo: Relation<Vehiculo>;

  // Lo que el cliente reporta al dejar el carro.
  @Column({ type: 'text' })
  motivo: string;

  @Column({ type: 'integer', nullable: true })
  kilometraje: number | null;

  @Column({ type: 'enum', enum: ESTADOS, default: 'recibido' })
  estado: Estado;

  @Column({ name: 'motivo_cancelacion', type: 'text', nullable: true })
  motivoCancelacion: string | null;

  @Column({ type: 'enum', enum: ORIGENES, default: 'taller' })
  origen: Origen;

  // Línea de tiempo de la orden: cada cambio de estado con su fecha y responsable.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  historial: PasoHistorial[];

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'creada_por' })
  creadaPor: Relation<Usuario>;

  @OneToMany(() => Asignacion, (a) => a.orden)
  asignaciones: Relation<Asignacion[]>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
