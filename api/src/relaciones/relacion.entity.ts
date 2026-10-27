import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { CabeceraVin, Cobertura } from '../integraciones/concesionario/proveedor';

// Copia local de lo que el concesionario sabe de la relación cliente–vehículo. El
// id_relacion es suyo: con él el taller sabe a quién le hace el control.
@Entity('relaciones_vehiculo')
export class RelacionVehiculo {
  @PrimaryColumn({ name: 'id_relacion', type: 'varchar', length: 60 })
  idRelacion: string;

  @Column({ type: 'varchar', length: 20 })
  cedula: string;

  @Column({ type: 'varchar', length: 160 })
  cliente: string;

  @Column({ type: 'varchar', length: 30, default: '' })
  telefono: string;

  @Column({ type: 'varchar', length: 17 })
  vin: string;

  @Column({ type: 'varchar', length: 10, default: '' })
  placa: string;

  @Column({ type: 'integer', default: 0 })
  kilometraje: number;

  @Column({ name: 'cabecera_vin', type: 'jsonb' })
  cabeceraVin: CabeceraVin;

  @Column({ type: 'jsonb' })
  garantia: Cobertura;

  @UpdateDateColumn({ name: 'consultado_en', type: 'timestamptz' })
  consultadoEn: Date;
}
