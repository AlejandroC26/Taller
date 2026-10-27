import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Orden } from '../ordenes/orden.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { Tarea } from './tarea.entity';

// Foto o PDF que respalda el dictamen de garantía del mecánico. El archivo vive en
// api/almacen/evidencias/ (fuera del repositorio); aquí solo sus datos.
@Entity('evidencias')
export class Evidencia {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Orden, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: Relation<Orden>;

  @ManyToOne(() => Tarea, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tarea_id' })
  tarea: Relation<Tarea> | null;

  @Column({ type: 'varchar', length: 160 })
  nombre: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: string;

  @Column({ type: 'varchar', length: 200 })
  ruta: string;

  @Column({ type: 'integer' })
  tamano: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'subida_por' })
  subidaPor: Relation<Usuario>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
