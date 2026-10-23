import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Vehiculo } from './vehiculo.entity';

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 80 })
  nombre: string;

  @Column({ type: 'varchar', length: 80 })
  apellido: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  documento: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  correo: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  direccion: string | null;

  @OneToMany(() => Vehiculo, (v) => v.cliente)
  vehiculos: Relation<Vehiculo[]>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
