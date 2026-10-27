// Formas de las respuestas de la API (taller/api). Si cambia un service, se cambia aquí.

export type Rol = 'administrador' | 'mecanico' | 'agente' | (string & {});

export interface Actor {
  id: string;
  nombre: string;
  apellido: string;
  usuario: string;
  rol: Rol;
  tallerId: number | null;
}

export const ESTADOS = [
  'agendada',
  'en_diagnostico',
  'remitida',
  'validando_garantia',
  'en_cotizacion',
  'aprobada',
  'rechazada',
  'en_reparacion',
  'pendiente_facturacion',
  'facturada',
  'entregada',
  'cancelada',
] as const;
export type Estado = (typeof ESTADOS)[number];
export type Etapa = 'diagnostico' | 'reparacion';

export const ESPECIALIDADES = ['mantenimiento_general', 'frenos', 'suspension', 'motor', 'electrico', 'transmision'] as const;
export type Especialidad = (typeof ESPECIALIDADES)[number];

export const CAUSAS = ['defecto_fabrica', 'repuesto_defectuoso', 'mala_instalacion_taller', 'manipulacion_cliente', 'desgaste_normal'] as const;
export type Causa = (typeof CAUSAS)[number];
export type Pagador = 'cliente' | 'fabricante' | 'tienda' | 'taller';

export interface Sede {
  id: number;
  codigo: string;
  nombre: string;
  tipo: 'mantenimiento' | 'especializado';
  especialidades: Especialidad[];
  ubicacion: { ciudad: string; direccion: string; latitud: number | null; longitud: number | null };
  telefono: string;
  horario: { dias: number[]; apertura: string; cierre: string };
  activo: boolean;
}

export interface Vehiculo {
  vin: string;
  marca: string;
  modelo: string;
  anio: number;
  version: string;
  carroceria: string;
  puertas: number;
  motor: string;
  combustible: string;
  transmision: string;
  placa: string;
  kilometraje: number;
}

export interface Cobertura {
  vigente: boolean;
  vence: string;
  kmMaximo: number;
  cubre: Especialidad[];
  motivo?: string;
}

export interface Prediagnostico {
  especialidad: Especialidad;
  servicios: string[];
  confianza: number;
  ruta: 'especializada' | 'revision_general';
  resumen: string;
  fuente: 'modelo' | 'reglas';
}

export interface PasoHistorial {
  estado: Estado;
  fecha: string;
  usuario: string;
  nota?: string;
}

export interface Orden {
  codigo: string;
  estado: Estado;
  siguiente_paso: { responsable: string; descripcion: string };
  acciones_disponibles: string[];
  sede: Sede;
  remitida_desde: { codigo: string; nombre: string; nota: string | null } | null;
  id_relacion: string;
  cliente: { cedula: string; nombre: string; telefono: string };
  vehiculo: Vehiculo;
  garantia: Cobertura;
  fecha_cita: string | null;
  kilometraje: number | null;
  mensajes_cliente: { texto: string; fecha?: string }[];
  sintomas: string;
  prediagnostico: Prediagnostico | null;
  por_garantia: boolean;
  motivo_reclamo: string | null;
  motivo_cancelacion: string | null;
  asignaciones: { id: number; etapa: Etapa; mecanico_id: string; mecanico: string }[];
  historial: PasoHistorial[];
  creado_en: string;
  actualizado_en: string;
}

export interface OrdenDetalle extends Orden {
  diagnostico: { estado: string; mecanico: string; servicios: number; total_mano_obra: number; repuestos: number } | null;
  reparacion: { estado: string; iniciada_en: string; terminada_en: string | null; total_mano_obra: number | null } | null;
}

export interface Evidencia {
  id: number;
  nombre: string;
  tipo: string;
  url: string;
}

export interface ServicioDiagnostico {
  id: number;
  posicion: number;
  sku: string;
  servicio: string;
  especialidad: Especialidad;
  precio: number;
  descripcion: string;
  causa: Causa | null;
  causa_nombre: string | null;
  garantia: { aplica: boolean; motivo: string; valida: boolean | null; respuesta: string | null; pagador: Pagador };
  completada: boolean;
  fija: boolean;
  repuestos: { id: number; codigo_repuesto: string; descripcion: string; cantidad: number }[];
  evidencias: Evidencia[];
}

export interface Diagnostico {
  orden: string;
  estado_orden: Estado;
  estado: 'borrador' | 'finalizado' | 'cancelado';
  mecanico: string;
  observaciones: string;
  por_garantia: boolean;
  motivo_reclamo: string | null;
  garantia_vehiculo: Cobertura;
  servicios: ServicioDiagnostico[];
  evidencias_orden: Evidencia[];
  total_mano_obra: number;
  repuestos_a_comprar: number;
  finalizado_en: string | null;
}

export interface LineaCompra {
  id: number;
  codigo_repuesto: string;
  descripcion: string;
  cantidad: number;
  tienda: string;
  precio_unitario: number;
  pagador: Pagador;
}

export interface Reparacion {
  orden: string;
  estado_orden: Estado;
  estado: 'en_curso' | 'terminada' | 'cancelada';
  iniciada_en: string;
  terminada_en: string | null;
  servicios: { id: number; posicion: number; sku: string; servicio: string; descripcion: string; precio: number; pagador: Pagador; garantia_valida: boolean | null; completada: boolean; fija: boolean }[];
  orden_compra: LineaCompra[];
  horas: { id: number; mecanico: string; mecanico_id: string; tarea_id: number | null; inicio: string; fin: string; horas: number; nota: string }[];
  partes_usadas: { id: number; codigo_repuesto: string; descripcion: string; cantidad: number; compra_id: number | null; tienda: string | null; nota: string }[];
  control: { horas_estandar: number; horas_reales: number; eficiencia: number | null };
  mano_obra_cotizada: number;
  mano_obra_realizada: number;
}

export interface Servicio {
  sku: string;
  nombre: string;
  especialidad: Especialidad;
  precio_mano_obra: number;
  horas_estandar: number;
  descripcion: string;
  activo: boolean;
}

export interface CodigoRepuesto {
  codigo: string;
  descripcion: string;
  sistema: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  usuario: string;
  rol: Rol;
  taller: { id: number; codigo: string; nombre: string } | null;
  activo: boolean;
}
