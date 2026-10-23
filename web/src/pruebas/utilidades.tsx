// Ayudas para las pruebas de componentes y páginas.
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import type { Actor, Rol } from '../api/tipos';
import { SesionProvider } from '../sesion/sesion';

export const actorDe = (rol: Rol, id = `id-${rol}`): Actor => ({ id, nombre: 'Ana', apellido: 'Prueba', usuario: rol, rol });

type Respuesta = unknown | ((init: RequestInit) => unknown);
export interface Llamada {
  metodo: string;
  url: string;
  cuerpo: unknown;
}

// Reemplaza fetch con una tabla de rutas: 'GET /api/x', '/api/x' o la ruta sin consulta.
// Una respuesta { estado, json } simula un error de la API.
export function simularApi(rutas: Record<string, Respuesta>) {
  const llamadas: Llamada[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, init = {}) => {
    const url = String(entrada);
    const metodo = (init.method ?? 'GET').toUpperCase();
    const cuerpo = init.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ metodo, url, cuerpo });
    const sinConsulta = url.split('?')[0];
    const clave = [`${metodo} ${url}`, `${metodo} ${sinConsulta}`, url, sinConsulta].find((k) => k in rutas);
    if (!clave) return new Response(JSON.stringify({ message: `Sin simular: ${metodo} ${url}` }), { status: 500 });
    const valor = rutas[clave];
    const r = typeof valor === 'function' ? (valor as (i: RequestInit) => unknown)(init) : valor;
    if (r && typeof r === 'object' && 'estado' in r && 'json' in r) {
      const { estado, json } = r as { estado: number; json: unknown };
      return new Response(JSON.stringify(json), { status: estado });
    }
    return new Response(JSON.stringify(r ?? null), { status: 200 });
  });
  return llamadas;
}

// Monta una página con router y sesión. Con actor, la sesión ya está iniciada.
export function renderizar(
  ui: ReactNode,
  { ruta = '/', patron = '*', actor, rutas = {} }: { ruta?: string; patron?: string; actor?: Actor; rutas?: Record<string, Respuesta> } = {},
) {
  if (actor) sessionStorage.setItem('taller.token', 'token-prueba');
  const llamadas = simularApi({ '/api/auth/yo': actor ?? { estado: 401, json: { message: 'Falta el token' } }, ...rutas });
  const resultado = render(
    <MemoryRouter initialEntries={[ruta]}>
      <SesionProvider>
        <Routes>
          <Route path={patron} element={ui} />
          <Route path="/entrar" element={<p>Pantalla de entrada</p>} />
          <Route path="/panel" element={<p>Pantalla del panel</p>} />
          <Route path="/mis-trabajos" element={<p>Pantalla de mis trabajos</p>} />
        </Routes>
      </SesionProvider>
    </MemoryRouter>,
  );
  return { ...resultado, llamadas };
}

export const orden = (cambios: Record<string, unknown> = {}) => ({
  codigo: 'OT-0001',
  estado: 'recibido',
  motivo: 'Ruido al frenar',
  kilometraje: 45000,
  origen: 'taller',
  motivoCancelacion: null,
  vehiculo: { id: 1, placa: 'ABC123', marca: 'Mazda', modelo: '3', anio: 2021, color: 'Gris', kilometraje: 45000, origen: 'taller', referenciaExterna: null },
  cliente: { id: 1, nombre: 'Carlos Rojas', documento: '1020', telefono: '300' },
  asignaciones: [],
  historial: [{ estado: 'recibido', fecha: '2026-10-22T13:00:00Z', usuario: 'Rosa Prueba' }],
  creadoEn: '2026-10-22T13:00:00Z',
  actualizadoEn: '2026-10-22T13:00:00Z',
  diagnostico: null,
  reparacion: null,
  ...cambios,
});
