import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { RelacionVehiculo } from '../relaciones/relacion.entity';
import { Taller } from './taller.entity';

// Una franja apartada (RS-0001) mientras el cliente confirma la hora con el concesionario.
// Ocupa cupo hasta que vence o hasta que se agenda la cita con ella.
@Entity('reservas_franja')
export class ReservaFranja {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Taller, { nullable: false })
  @JoinColumn({ name: 'taller_id' })
  taller: Relation<Taller>;

  @Column({ name: 'fecha_hora', type: 'timestamptz' })
  fechaHora: Date;

  @ManyToOne(() => RelacionVehiculo, { nullable: false })
  @JoinColumn({ name: 'id_relacion' })
  relacion: Relation<RelacionVehiculo>;

  @Column({ name: 'vence_en', type: 'timestamptz' })
  venceEn: Date;

  // true cuando ya se agendó con ella o el mismo vehículo apartó otra hora.
  @Column({ type: 'boolean', default: false })
  usada: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
