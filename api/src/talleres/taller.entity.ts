import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numerico } from '../comun/columnas';
import { TIPOS_TALLER } from './reglas';
import type { Especialidad, Horario, TipoTaller } from './reglas';

// Una sede de Pulgas Locas S.A.S. La de mantenimiento hace la revisión general; las
// especializadas reciben lo que se les remite o lo que el prediagnóstico ve claro.
@Entity('talleres')
export class Taller {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'enum', enum: TIPOS_TALLER })
  tipo: TipoTaller;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  especialidades: Especialidad[];

  @Column({ type: 'varchar', length: 60 })
  ciudad: string;

  @Column({ type: 'varchar', length: 200 })
  direccion: string;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true, transformer: numerico })
  latitud: number | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true, transformer: numerico })
  longitud: number | null;

  @Column({ type: 'varchar', length: 30, default: '' })
  telefono: string;

  @Column({ type: 'jsonb' })
  horario: Horario;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
