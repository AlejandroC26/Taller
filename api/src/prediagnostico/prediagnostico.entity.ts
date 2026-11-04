import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { MensajeCliente } from '../ordenes/orden.entity';
import { RelacionVehiculo } from '../relaciones/relacion.entity';
import { Taller } from '../talleres/taller.entity';
import type { Prediagnostico } from './reglas';

// Un prediagnóstico ya calculado (PD-0001). El concesionario le muestra al cliente la sede
// que salió aquí y después agenda con este id: así la cita no vuelve a llamar al modelo ni
// puede terminar en otra sede.
@Entity('prediagnosticos')
export class PrediagnosticoGuardado {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => RelacionVehiculo, { nullable: false })
  @JoinColumn({ name: 'id_relacion' })
  relacion: Relation<RelacionVehiculo>;

  // La sede decidida (puede faltar si no hay sedes activas).
  @ManyToOne(() => Taller, { nullable: true })
  @JoinColumn({ name: 'taller_id' })
  taller: Relation<Taller> | null;

  @Column({ type: 'jsonb' })
  resultado: Prediagnostico;

  @Column({ name: 'mensajes_cliente', type: 'jsonb', default: () => "'[]'" })
  mensajesCliente: MensajeCliente[];

  @Column({ name: 'por_garantia', type: 'boolean', default: false })
  porGarantia: boolean;

  @Column({ name: 'motivo_reclamo', type: 'text', nullable: true })
  motivoReclamo: string | null;

  @Column({ type: 'integer', nullable: true })
  kilometraje: number | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
