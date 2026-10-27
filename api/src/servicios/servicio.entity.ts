import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numerico } from '../comun/columnas';
import { ESPECIALIDADES } from '../talleres/reglas';
import type { Especialidad } from '../talleres/reglas';

// Catálogo de servicios de la S.A.S.: el SKU fija el precio de la mano de obra, igual en
// todas las sedes. Las horas estándar sirven para la agenda y el control, no para cobrar.
@Entity('servicios')
export class Servicio {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'enum', enum: ESPECIALIDADES })
  especialidad: Especialidad;

  @Column({ name: 'precio_mano_obra', type: 'numeric', precision: 12, scale: 2, transformer: numerico })
  precioManoObra: number;

  @Column({ name: 'horas_estandar', type: 'numeric', precision: 5, scale: 2, transformer: numerico })
  horasEstandar: number;

  // Palabras que, en lo que cuenta el cliente, apuntan a este servicio (prediagnóstico).
  @Column({ name: 'palabras_clave', type: 'jsonb', default: () => "'[]'" })
  palabrasClave: string[];

  @Column({ type: 'varchar', length: 300, default: '' })
  descripcion: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
