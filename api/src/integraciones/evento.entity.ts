import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const DESTINOS = ['concesionario', 'facturacion'] as const;
export type Destino = (typeof DESTINOS)[number];

export const ESTADOS_EVENTO = ['pendiente', 'enviado', 'fallido', 'desactivado'] as const;
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number];

// Bandeja de salida hacia los otros proyectos. Los services escriben aquí dentro de su
// transacción y el despachador envía después: si el otro sistema está caído, el
// taller sigue funcionando y el evento se reintenta.
@Entity('eventos_integracion')
export class EventoIntegracion {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'enum', enum: DESTINOS })
  destino: Destino;

  // Nombre de la herramienta MCP del otro proyecto; por ejemplo: emitir_factura.
  @Column({ type: 'varchar', length: 60 })
  herramienta: string;

  @Column({ type: 'jsonb' })
  datos: Record<string, unknown>;

  @Column({ type: 'enum', enum: ESTADOS_EVENTO, default: 'pendiente' })
  estado: EstadoEvento;

  @Column({ type: 'integer', default: 0 })
  intentos: number;

  @Column({ name: 'ultimo_error', type: 'text', nullable: true })
  ultimoError: string | null;

  // Lo que contestó el otro proyecto, como texto.
  @Column({ type: 'text', nullable: true })
  respuesta: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'enviado_en', type: 'timestamptz', nullable: true })
  enviadoEn: Date | null;
}
