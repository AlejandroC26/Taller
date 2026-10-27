import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Llamadas de otros agentes ya procesadas. Si un agente repite una llamada con el mismo
// id_mensaje (por un reintento), el taller devuelve el mismo resultado sin repetir nada.
@Entity('mensajes_recibidos')
export class MensajeRecibido {
  @PrimaryColumn({ name: 'id_mensaje', type: 'varchar', length: 120 })
  idMensaje: string;

  @Column({ type: 'varchar', length: 60 })
  herramienta: string;

  @Column({ type: 'jsonb', nullable: true })
  resultado: unknown;

  @CreateDateColumn({ name: 'recibido_en', type: 'timestamptz' })
  recibidoEn: Date;
}
