import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { numerico } from '../comun/columnas';
import { Tarea } from '../diagnosticos/tarea.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Reparacion } from './reparacion.entity';

// Tiempo trabajado por un mecánico en la reparación.
@Entity('registros_horas')
export class RegistroHoras {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Reparacion, (r) => r.horas, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reparacion_id' })
  reparacion: Relation<Reparacion>;

  @ManyToOne(() => Usuario, { nullable: false, eager: true })
  @JoinColumn({ name: 'mecanico_id' })
  mecanico: Relation<Usuario>;

  @ManyToOne(() => Tarea, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tarea_id' })
  tarea: Relation<Tarea> | null;

  @Column({ type: 'timestamptz' })
  inicio: Date;

  @Column({ type: 'timestamptz' })
  fin: Date;

  @Column({ type: 'numeric', precision: 6, scale: 2, transformer: numerico })
  horas: number;

  @Column({ type: 'varchar', length: 300, default: '' })
  nota: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
