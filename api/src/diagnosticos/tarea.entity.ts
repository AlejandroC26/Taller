import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { numerico } from '../comun/columnas';
import { CAUSAS, PAGADORES } from '../garantias/reglas';
import type { Causa, Pagador } from '../garantias/reglas';
import { ESPECIALIDADES } from '../talleres/reglas';
import type { Especialidad } from '../talleres/reglas';
import { Diagnostico } from './diagnostico.entity';
import { Repuesto } from './repuesto.entity';

// Un servicio del diagnóstico: qué hacer (SKU con su precio de mano de obra), por qué
// falló, si el mecánico cree que va por garantía y qué respondió el concesionario.
@Entity('diagnostico_tareas')
export class Tarea {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @ManyToOne(() => Diagnostico, (d) => d.tareas, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diagnostico_id' })
  diagnostico: Relation<Diagnostico>;

  @Column({ type: 'integer' })
  posicion: number;

  @Column({ name: 'servicio_sku', type: 'varchar', length: 30 })
  servicioSku: string;

  @Column({ name: 'servicio_nombre', type: 'varchar', length: 120 })
  servicioNombre: string;

  @Column({ type: 'enum', enum: ESPECIALIDADES })
  especialidad: Especialidad;

  // Copia del precio del SKU al diagnosticar: si el catálogo cambia, no altera lo cotizado.
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numerico })
  precio: number;

  // Lo que el mecánico encontró y va a hacer.
  @Column({ type: 'text', default: '' })
  descripcion: string;

  @Column({ type: 'enum', enum: CAUSAS, nullable: true })
  causa: Causa | null;

  // Dictamen del mecánico.
  @Column({ name: 'garantia_aplica', type: 'boolean', default: false })
  garantiaAplica: boolean;

  @Column({ name: 'garantia_motivo', type: 'text', default: '' })
  garantiaMotivo: string;

  // Respuesta del concesionario (null mientras no responde).
  @Column({ name: 'garantia_valida', type: 'boolean', nullable: true })
  garantiaValida: boolean | null;

  @Column({ name: 'garantia_respuesta', type: 'text', nullable: true })
  garantiaRespuesta: string | null;

  @Column({ type: 'enum', enum: PAGADORES, default: 'cliente' })
  pagador: Pagador;

  @Column({ type: 'boolean', default: false })
  completada: boolean;

  // Fija: la puso el sistema (la revisión general al remitir); no se edita ni se borra.
  @Column({ type: 'boolean', default: false })
  fija: boolean;

  @OneToMany(() => Repuesto, (r) => r.tarea, { cascade: true })
  repuestos: Relation<Repuesto[]>;
}
