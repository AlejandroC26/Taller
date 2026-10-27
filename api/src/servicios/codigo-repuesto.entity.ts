import { Column, Entity, PrimaryColumn } from 'typeorm';

// Código universal de un repuesto: es el mismo en todas las tiendas. Solo sirve para que
// el mecánico lo elija sin escribirlo; el taller no maneja precio ni existencias.
@Entity('codigos_repuesto')
export class CodigoRepuesto {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  codigo: string;

  @Column({ type: 'varchar', length: 160 })
  descripcion: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  sistema: string;
}
