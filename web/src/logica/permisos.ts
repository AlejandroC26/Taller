import type { Rol } from '../api/tipos';

// Espejo de los permisos de la API para mostrar u ocultar acciones. La API es la que
// decide de verdad: esto solo evita botones que darían 403. La web es del mecánico (y
// del administrador, que además gestiona usuarios); los agentes usan el MCP.
export const ROLES = ['administrador', 'mecanico', 'agente'] as const;

export const puede = {
  usarTablero: (rol: Rol) => rol === 'mecanico' || rol === 'administrador',
  administrar: (rol: Rol) => rol === 'administrador',
  // Diagnóstico, evidencias, horas y partes: el mecánico asignado a la etapa o el
  // administrador.
  trabajar: (rol: Rol, asignadoALaEtapa: boolean) => rol === 'administrador' || (rol === 'mecanico' && asignadoALaEtapa),
  tomar: (rol: Rol) => rol === 'mecanico',
};

export function inicioDe(rol: Rol): string {
  return puede.usarTablero(rol) ? '/mis-trabajos' : '/sin-acceso';
}

export interface Enlace {
  a: string;
  texto: string;
}

export function enlacesDe(rol: Rol): Enlace[] {
  const enlaces: Enlace[] = [];
  if (rol === 'mecanico') enlaces.push({ a: '/mis-trabajos', texto: 'Mis trabajos' });
  if (puede.administrar(rol)) enlaces.push({ a: '/mis-trabajos', texto: 'Órdenes' }, { a: '/usuarios', texto: 'Usuarios' });
  return enlaces;
}
