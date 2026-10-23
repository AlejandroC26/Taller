import type { Rol } from '../api/tipos';

// Espejo de los permisos de la API para mostrar u ocultar acciones. La API es la que
// decide de verdad: esto solo evita botones que darían 403.
const PERSONAL: readonly string[] = ['administrador', 'recepcionista'];
const TALLER: readonly string[] = [...PERSONAL, 'mecanico'];

export const puede = {
  verPanel: (rol: Rol) => PERSONAL.includes(rol),
  gestionarOrdenes: (rol: Rol) => PERSONAL.includes(rol),
  gestionarClientes: (rol: Rol) => PERSONAL.includes(rol),
  verInventario: (rol: Rol) => TALLER.includes(rol),
  editarInventario: (rol: Rol) => PERSONAL.includes(rol),
  cambiarTarifa: (rol: Rol) => PERSONAL.includes(rol),
  administrar: (rol: Rol) => rol === 'administrador',
  // Diagnóstico, horas y partes: el mecánico asignado a la etapa o el administrador.
  trabajar: (rol: Rol, asignadoALaEtapa: boolean) =>
    rol === 'administrador' || (rol === 'mecanico' && asignadoALaEtapa),
};

export function inicioDe(rol: Rol): string {
  if (rol === 'mecanico') return '/mis-trabajos';
  if (PERSONAL.includes(rol)) return '/panel';
  return '/sin-acceso';
}

export interface Enlace {
  a: string;
  texto: string;
}

export function enlacesDe(rol: Rol): Enlace[] {
  const enlaces: Enlace[] = [];
  if (puede.verPanel(rol)) enlaces.push({ a: '/panel', texto: 'Panel' });
  if (rol === 'mecanico') enlaces.push({ a: '/mis-trabajos', texto: 'Mis trabajos' });
  if (TALLER.includes(rol)) enlaces.push({ a: '/ordenes', texto: 'Órdenes' });
  if (puede.gestionarClientes(rol)) enlaces.push({ a: '/clientes', texto: 'Clientes' });
  if (puede.verInventario(rol)) enlaces.push({ a: '/inventario', texto: 'Inventario' });
  if (puede.administrar(rol)) {
    enlaces.push({ a: '/usuarios', texto: 'Usuarios' }, { a: '/roles', texto: 'Roles' }, { a: '/integraciones', texto: 'Integraciones' });
  }
  return enlaces;
}
