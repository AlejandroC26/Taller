// Ayudas para las pruebas de componentes y páginas.
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import type { Actor, Rol } from '../api/tipos';
import { SesionProvider } from '../sesion/sesion';
import { TemaProvider } from '../tema/tema';

export const actorDe = (rol: Rol, id = `id-${rol}`, tallerId: number | null = rol === 'mecanico' ? 1 : null): Actor => ({
  id,
  nombre: 'Ana',
  apellido: 'Prueba',
  usuario: rol,
  rol,
  tallerId,
});

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
    // Un FormData (subida de archivos) se deja tal cual para revisar sus campos.
    const cuerpo = init.body instanceof FormData ? init.body : init.body ? JSON.parse(String(init.body)) : undefined;
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
    <TemaProvider>
      <MemoryRouter initialEntries={[ruta]}>
        <SesionProvider>
          <Routes>
            <Route path={patron} element={ui} />
            <Route path="/entrar" element={<p>Pantalla de entrada</p>} />
            <Route path="/panel" element={<p>Pantalla del panel</p>} />
            <Route path="/mis-trabajos" element={<p>Pantalla de mis trabajos</p>} />
          </Routes>
        </SesionProvider>
      </MemoryRouter>
    </TemaProvider>,
  );
  return { ...resultado, llamadas };
}

export const sede = (cambios: Record<string, unknown> = {}) => ({
  id: 1,
  codigo: 'PL-CENTRO',
  nombre: 'Pulgas Locas Centro',
  tipo: 'mantenimiento',
  especialidades: ['mantenimiento_general'],
  ubicacion: { ciudad: 'Bogotá', direccion: 'Cra 13 # 45-20', latitud: null, longitud: null },
  telefono: '6010000000',
  horario: { dias: [1, 2, 3, 4, 5, 6], apertura: '08:00', cierre: '17:00' },
  activo: true,
  ...cambios,
});

export const sedeFrenos = () => sede({ id: 2, codigo: 'PL-FRENOS', nombre: 'Pulgas Locas Frenos', tipo: 'especializado', especialidades: ['frenos', 'suspension'] });

export const orden = (cambios: Record<string, unknown> = {}) => ({
  codigo: 'OT-0001',
  estado: 'agendada',
  siguiente_paso: { responsable: 'mecanico', descripcion: 'Un mecánico de la sede debe tomarla' },
  acciones_disponibles: ['tomar_orden'],
  sede: sede(),
  remitida_desde: null,
  id_relacion: 'REL-1001',
  cliente: { cedula: '1020', nombre: 'Carlos Rojas', telefono: '300' },
  vehiculo: {
    vin: '9BWZZZ377VT004251',
    marca: 'Mazda',
    modelo: '3',
    anio: 2024,
    version: 'Touring',
    carroceria: 'Sedán',
    puertas: 4,
    motor: '2.0 L',
    combustible: 'Gasolina',
    transmision: 'Automática',
    placa: 'ABC123',
    kilometraje: 45000,
  },
  garantia: { vigente: true, vence: '2027-03-01', kmMaximo: 60000, cubre: ['frenos', 'motor'] },
  fecha_cita: '2026-10-27T13:00:00Z',
  kilometraje: 45000,
  mensajes_cliente: [{ texto: 'Chilla al frenar' }],
  sintomas: 'Chilla al frenar',
  prediagnostico: { especialidad: 'frenos', servicios: ['FRE-PAST-DEL'], confianza: 0.8, ruta: 'especializada', resumen: 'Probable desgaste de pastillas', fuente: 'reglas' },
  por_garantia: false,
  motivo_reclamo: null,
  motivo_cancelacion: null,
  asignaciones: [],
  historial: [{ estado: 'agendada', fecha: '2026-10-22T13:00:00Z', usuario: 'Agente concesionario' }],
  creado_en: '2026-10-22T13:00:00Z',
  actualizado_en: '2026-10-22T13:00:00Z',
  diagnostico: null,
  reparacion: null,
  ...cambios,
});

export const catalogo = [
  { sku: 'REV-GENERAL', nombre: 'Revisión general', especialidad: 'mantenimiento_general', precio_mano_obra: 60000, horas_estandar: 1, descripcion: '', activo: true },
  { sku: 'FRE-PAST-DEL', nombre: 'Cambio de pastillas delanteras', especialidad: 'frenos', precio_mano_obra: 90000, horas_estandar: 1.5, descripcion: '', activo: true },
  { sku: 'MOT-AFINACION', nombre: 'Afinación', especialidad: 'motor', precio_mano_obra: 180000, horas_estandar: 3, descripcion: '', activo: true },
];

export const servicioDiagnostico = (cambios: Record<string, unknown> = {}) => ({
  id: 11,
  posicion: 1,
  sku: 'FRE-PAST-DEL',
  servicio: 'Cambio de pastillas delanteras',
  especialidad: 'frenos',
  precio: 90000,
  descripcion: 'Pastillas al 10 %',
  causa: null,
  causa_nombre: null,
  garantia: { aplica: false, motivo: '', valida: null, respuesta: null, pagador: 'cliente' },
  completada: false,
  fija: false,
  repuestos: [],
  evidencias: [],
  ...cambios,
});

export const diagnostico = (cambios: Record<string, unknown> = {}) => ({
  orden: 'OT-0001',
  estado_orden: 'en_diagnostico',
  estado: 'borrador',
  mecanico: 'Ana Prueba',
  observaciones: '',
  por_garantia: false,
  motivo_reclamo: null,
  garantia_vehiculo: orden().garantia,
  servicios: [],
  evidencias_orden: [],
  total_mano_obra: 0,
  repuestos_a_comprar: 0,
  finalizado_en: null,
  ...cambios,
});

export const reparacion = (cambios: Record<string, unknown> = {}) => ({
  orden: 'OT-0001',
  estado_orden: 'en_reparacion',
  estado: 'en_curso',
  iniciada_en: '2026-10-23T13:00:00Z',
  terminada_en: null,
  servicios: [
    { id: 11, posicion: 1, sku: 'FRE-PAST-DEL', servicio: 'Cambio de pastillas delanteras', descripcion: '', precio: 90000, pagador: 'cliente', garantia_valida: false, completada: false, fija: false },
  ],
  orden_compra: [{ id: 5, codigo_repuesto: 'PAS-DEL-CER', descripcion: 'Pastillas delanteras cerámicas', cantidad: 1, tienda: 'Repuestos El Gato', precio_unitario: 150000, pagador: 'cliente' }],
  horas: [],
  partes_usadas: [],
  control: { horas_estandar: 1.5, horas_reales: 0, eficiencia: null },
  mano_obra_cotizada: 90000,
  mano_obra_realizada: 0,
  ...cambios,
});
