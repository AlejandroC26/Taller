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
import type { Prediagnostico } from '../prediagnostico/reglas';
import { RelacionVehiculo } from '../relaciones/relacion.entity';
import { Taller } from '../talleres/taller.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Asignacion } from './asignacion.entity';
import { ESTADOS } from './reglas';
import type { Estado, PasoHistorial } from './reglas';

export interface MensajeCliente {
  fecha?: string;
  texto: string;
}

// La orden de servicio: nace como cita agendada por el concesionario y recorre las sedes
// de la S.A.S. hasta que el vehículo sale.
@Entity('ordenes')
export class Orden {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => RelacionVehiculo, { nullable: false })
  @JoinColumn({ name: 'id_relacion' })
  relacion: Relation<RelacionVehiculo>;

  // Sede donde está hoy la orden.
  @ManyToOne(() => Taller, { nullable: false })
  @JoinColumn({ name: 'taller_id' })
  taller: Relation<Taller>;

  @Column({ name: 'fecha_cita', type: 'timestamptz', nullable: true })
  fechaCita: Date | null;

  // Lo que el cliente le contó al concesionario.
  @Column({ name: 'mensajes_cliente', type: 'jsonb', default: () => "'[]'" })
  mensajesCliente: MensajeCliente[];

  @Column({ type: 'text', default: '' })
  sintomas: string;

  @Column({ type: 'jsonb', nullable: true })
  prediagnostico: Prediagnostico | null;

  @Column({ type: 'integer', nullable: true })
  kilometraje: number | null;

  @Column({ name: 'por_garantia', type: 'boolean', default: false })
  porGarantia: boolean;

  @Column({ name: 'motivo_reclamo', type: 'text', nullable: true })
  motivoReclamo: string | null;

  @Column({ type: 'enum', enum: ESTADOS, default: 'agendada' })
  estado: Estado;

  @ManyToOne(() => Taller, { nullable: true })
  @JoinColumn({ name: 'remitida_desde' })
  remitidaDesde: Relation<Taller> | null;

  @Column({ name: 'nota_remision', type: 'text', nullable: true })
  notaRemision: string | null;

  @Column({ name: 'cotizacion_ref', type: 'varchar', length: 80, nullable: true })
  cotizacionRef: string | null;

  @Column({ name: 'pago_ref', type: 'varchar', length: 80, nullable: true })
  pagoRef: string | null;

  @Column({ name: 'motivo_cancelacion', type: 'text', nullable: true })
  motivoCancelacion: string | null;

  // Línea de tiempo: cada cambio de estado con su fecha y responsable.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  historial: PasoHistorial[];

  // Quién agendó (normalmente el agente del concesionario).
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
