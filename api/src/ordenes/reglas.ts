import { conflicto, invalido, prohibido } from '../comun/errores';

// Reglas puras de las órdenes de servicio. No tocan la base de datos: así se prueban
// solas y las cumple quien entre por cualquier puerta (web o MCP).

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

export const ETAPAS = ['diagnostico', 'reparacion'] as const;
export type Etapa = (typeof ETAPAS)[number];

export interface PasoHistorial {
  estado: Estado;
  fecha: string;
  usuario: string;
  nota?: string;
}

// Órdenes que todavía ocupan una sede.
export const ABIERTOS: readonly Estado[] = ESTADOS.filter((e) => e !== 'entregada' && e !== 'cancelada');

// Cambios de estado permitidos. Lo que no está aquí, no se puede hacer.
export const SIGUIENTE: Record<Estado, readonly Estado[]> = {
  agendada: ['en_diagnostico', 'cancelada'],
  en_diagnostico: ['remitida', 'validando_garantia', 'cancelada'],
  remitida: ['en_diagnostico', 'cancelada'],
  validando_garantia: ['en_cotizacion', 'cancelada'],
  en_cotizacion: ['aprobada', 'rechazada', 'cancelada'],
  aprobada: ['en_reparacion', 'cancelada'],
  rechazada: ['entregada'],
  en_reparacion: ['pendiente_facturacion'],
  pendiente_facturacion: ['facturada'],
  facturada: ['entregada'],
  entregada: [],
  cancelada: [],
};

export const puedePasar = (actual: Estado, nuevo: Estado) => SIGUIENTE[actual].includes(nuevo);

export function exigirTransicion(actual: Estado, nuevo: Estado, codigo: string) {
  if (!puedePasar(actual, nuevo)) {
    throw invalido(`La orden ${codigo} está ${actual}: no puede pasar a ${nuevo}`);
  }
}

// Quién mueve la orden en cada estado y con qué herramientas. Lo devuelve cada respuesta
// para que un orquestador encadene el flujo sin conocer la lógica interna.
export type Responsable = 'mecanico' | 'concesionario' | 'facturacion' | 'taller' | 'nadie';
export interface Paso {
  responsable: Responsable;
  descripcion: string;
  acciones: string[];
}

export const PASOS: Record<Estado, Paso> = {
  agendada: {
    responsable: 'mecanico',
    descripcion: 'Cita agendada: cuando llegue el vehículo, un mecánico de la sede toma la orden',
    acciones: ['tomar_orden', 'cancelar_cita'],
  },
  en_diagnostico: {
    responsable: 'mecanico',
    descripcion: 'El mecánico revisa el vehículo, registra el diagnóstico y lo finaliza, o lo remite a una sede especializada',
    acciones: ['registrar_diagnostico', 'adjuntar_evidencia', 'remitir_orden', 'finalizar_diagnostico', 'cancelar_cita'],
  },
  remitida: {
    responsable: 'mecanico',
    descripcion: 'Remitida a una sede especializada: un especialista de esa sede la toma',
    acciones: ['tomar_orden', 'cancelar_cita'],
  },
  validando_garantia: {
    responsable: 'concesionario',
    descripcion: 'El concesionario valida la garantía de cada servicio y responde con registrar_resultado_garantia',
    acciones: ['consultar_diagnostico', 'consultar_evidencias', 'registrar_resultado_garantia'],
  },
  en_cotizacion: {
    responsable: 'facturacion',
    descripcion:
      'Facturación cotiza los repuestos con las tiendas, le avisa al cliente por Telegram (con el resultado de la garantía) y responde con registrar_respuesta_cliente',
    acciones: ['consultar_cotizacion', 'registrar_respuesta_cliente'],
  },
  aprobada: {
    responsable: 'mecanico',
    descripcion: 'El cliente aceptó: un mecánico de la sede toma la reparación',
    acciones: ['tomar_orden', 'cancelar_cita'],
  },
  rechazada: {
    responsable: 'taller',
    descripcion: 'El cliente rechazó la cotización: se entrega el vehículo sin reparar',
    acciones: ['registrar_salida'],
  },
  en_reparacion: {
    responsable: 'mecanico',
    descripcion: 'El mecánico repara: registra horas, partes usadas y pasos hechos, y la termina',
    acciones: ['registrar_horas', 'registrar_parte_usada', 'marcar_tarea', 'terminar_reparacion'],
  },
  pendiente_facturacion: {
    responsable: 'facturacion',
    descripcion: 'Reparación terminada: facturación envía el PSE al cliente y confirma el pago con registrar_pago',
    acciones: ['consultar_cotizacion', 'registrar_pago'],
  },
  facturada: {
    responsable: 'taller',
    descripcion: 'Pagada: el vehículo puede salir; se registra con registrar_salida',
    acciones: ['registrar_salida'],
  },
  entregada: { responsable: 'nadie', descripcion: 'Orden cerrada: el vehículo salió', acciones: [] },
  cancelada: { responsable: 'nadie', descripcion: 'Orden cancelada', acciones: [] },
};

export const codigoOrden = (id: number) => 'OT-' + String(id).padStart(4, '0');

// Acepta OT-0001, ot-1, OT1 o solo el número.
export function numeroOrden(codigo: string): number | null {
  const numero = Number(/^(?:OT-?)?(\d{1,9})$/i.exec(String(codigo).trim())?.[1]);
  return numero > 0 ? numero : null;
}

// Tomar una orden: de la cola de la sede pasa a manos de un mecánico.
//   agendada o remitida → diagnóstico; aprobada → reparación.
export function etapaAlTomar(estado: Estado, codigo: string): { etapa: Etapa; pasaA: Estado } {
  if (estado === 'agendada' || estado === 'remitida') return { etapa: 'diagnostico', pasaA: 'en_diagnostico' };
  if (estado === 'aprobada') return { etapa: 'reparacion', pasaA: 'en_reparacion' };
  // 409: lo normal es que otro mecánico la haya tomado un momento antes.
  throw conflicto(`La orden ${codigo} está ${estado}: no hay nada que tomar`);
}

// Estados en los que la orden espera en la cola de su sede.
export const EN_COLA: readonly Estado[] = ['agendada', 'remitida', 'aprobada'];

// Se puede cancelar mientras no haya empezado la reparación.
export const CANCELABLES: readonly Estado[] = ESTADOS.filter((e) => SIGUIENTE[e].includes('cancelada'));

// Gestión (administrador y agentes) ve todo. El mecánico ve lo que tiene asignado y la
// cola de su sede; a quien no la ve se le responde 404, no 403.
export const esGestion = (rol: string) => rol === 'administrador' || rol === 'agente';

export function puedeVerOrden(
  rol: string,
  orden: { asignado: boolean; enMiSede: boolean; enCola: boolean },
): boolean {
  if (esGestion(rol)) return true;
  if (rol === 'mecanico') return orden.asignado || (orden.enMiSede && orden.enCola);
  return false;
}

// Quién registra diagnóstico, horas y partes: el mecánico asignado a esa etapa, o la
// gestión (un agente puede hacerlo por MCP).
export function exigirTrabajo(rol: string, asignadoALaEtapa: boolean, etapa: Etapa) {
  if (esGestion(rol)) return;
  if (rol === 'mecanico' && asignadoALaEtapa) return;
  throw prohibido(
    rol === 'mecanico'
      ? `No está asignado a la etapa de ${etapa} de esta orden: tómela primero`
      : 'Solo el mecánico asignado o la gestión registran este trabajo',
  );
}

export const paso = (estado: Estado, usuario: string, nota?: string): PasoHistorial => ({
  estado,
  fecha: new Date().toISOString(),
  usuario,
  ...(nota ? { nota } : {}),
});
