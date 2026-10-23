// Formas de las respuestas de la API (taller/api). Si cambia un service, se cambia aquí.

export type Rol = 'administrador' | 'recepcionista' | 'mecanico' | 'concesionario' | (string & {});

export interface Actor {
  id: string;
  nombre: string;
  apellido: string;
  usuario: string;
  rol: Rol;
}

export const ESTADOS = [
  'recibido',
  'en_diagnostico',
  'diagnosticado',
  'aprobado',
  'en_reparacion',
  'terminado',
  'entregado',
  'cancelado',
] as const;
export type Estado = (typeof ESTADOS)[number];
export type Etapa = 'diagnostico' | 'reparacion';

export interface Vehiculo {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  kilometraje: number;
  origen: 'taller' | 'concesionario';
  referenciaExterna: string | null;
}

export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  correo: string | null;
  direccion: string | null;
  vehiculos?: Vehiculo[];
}

export interface PasoHistorial {
  estado: Estado;
  fecha: string;
  usuario: string;
  nota?: string;
}

export interface Costo {
  horas: number;
  manoObra: number;
  servicios: number;
  repuestos: number;
  total: number;
}

export interface Orden {
  codigo: string;
  estado: Estado;
  motivo: string;
  kilometraje: number | null;
  origen: 'taller' | 'concesionario';
  motivoCancelacion: string | null;
  vehiculo: Vehiculo;
  cliente: { id: number; nombre: string; documento: string; telefono: string };
  asignaciones: { id: number; etapa: Etapa; mecanicoId: string; mecanico: string }[];
  historial: PasoHistorial[];
  creadaPor?: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface OrdenDetalle extends Orden {
  diagnostico: { estado: string; mecanico: string; tareas: number; costo: Costo } | null;
  reparacion: { estado: string; iniciadaEn: string; terminadaEn: string | null; total: number | null } | null;
}

export interface Repuesto {
  id?: number;
  itemId: number | null;
  codigo?: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  disponible?: boolean;
}

export interface Tarea {
  id?: number;
  posicion?: number;
  descripcion: string;
  horasEstimadas: number;
  valorServicio: number;
  requierePiezas: boolean;
  completada?: boolean;
  repuestos: Repuesto[];
}

export interface Diagnostico {
  orden: string;
  estadoOrden: Estado;
  estado: 'borrador' | 'finalizado' | 'cancelado';
  mecanico: string;
  observaciones: string;
  tarifaHora: number;
  finalizadoEn: string | null;
  tareas: Tarea[];
  costo: Costo;
}

export interface Reparacion {
  orden: string;
  estadoOrden: Estado;
  estado: 'en_curso' | 'terminada' | 'cancelada';
  iniciadaEn: string;
  terminadaEn: string | null;
  tarifaHora: number;
  tareas: { id: number; posicion: number; descripcion: string; horasEstimadas: number; valorServicio: number; completada: boolean }[];
  horas: { id: number; mecanico: string; mecanicoId: string; tareaId: number | null; inicio: string; fin: string; horas: number; nota: string }[];
  partes: { id: number; itemId: number; codigo: string; descripcion: string; cantidad: number; precioUnitario: number; subtotal: number }[];
  estimado: Costo;
  real: Costo;
  diferencia: number;
}

export interface Item {
  id: number;
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: number;
  nivelAlerta: number;
  categoria: string;
  categoriaId: number;
  activo: boolean;
  enAlerta: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Mecanico {
  id: string;
  nombre: string;
  carga: number;
  disponible: boolean;
  ordenes: { codigo: string; estado: Estado; etapa: Etapa }[];
}

export interface Panel {
  abiertas: number;
  enDiagnostico: number;
  porAprobar: number;
  enReparacion: number;
  listasParaEntregar: number;
  itemsEnAlerta: number;
  facturadoMes: number;
  ordenesFacturadasMes: number;
  ultimas: Orden[];
  mecanicos: Mecanico[];
}

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  usuario: string;
  rol: Rol;
  activo: boolean;
}

export interface RolInfo {
  id: number;
  nombre: string;
  descripcion: string;
  sistema: boolean;
  usuarios: number;
}

export interface EstadoIntegraciones {
  destinos: {
    destino: string;
    descripcion: string;
    configurado: boolean;
    herramientas: Record<string, string>;
    eventos: Record<string, number>;
  }[];
  ultimos: { id: number; destino: string; herramienta: string; estado: string; intentos: number; ultimoError: string | null; creadoEn: string }[];
}
