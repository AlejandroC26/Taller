import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as diagnosticos from '@/diagnosticos/diagnosticos.service';
import { actorDe, conParams, leer, peticion } from '@/comun/pruebas';
import * as ordenes from '@/ordenes/ordenes.service';
import * as reparaciones from '@/reparaciones/reparaciones.service';
import * as usuarios from '@/usuarios/usuarios.service';
import { POST as asignar } from './[codigo]/asignaciones/route';
import { POST as cancelar } from './[codigo]/cancelar/route';
import { GET as verDiagnostico, PUT as guardarDiagnostico } from './[codigo]/diagnostico/route';
import { POST as estado } from './[codigo]/estado/route';
import { POST as horas } from './[codigo]/reparacion/horas/route';
import { POST as partes } from './[codigo]/reparacion/partes/route';
import { PATCH as tarea } from './[codigo]/reparacion/tareas/[id]/route';
import { GET, POST } from './route';

vi.mock('@/usuarios/usuarios.service', () => ({ actorDelToken: vi.fn() }));
vi.mock('@/ordenes/ordenes.service', () => ({
  listarOrdenes: vi.fn(async () => []),
  crearOrden: vi.fn(async () => ({ codigo: 'OT-0001' })),
  asignar: vi.fn(async () => ({})),
  cambiarEstado: vi.fn(async () => ({})),
  cancelar: vi.fn(async () => ({})),
}));
vi.mock('@/diagnosticos/diagnosticos.service', () => ({
  verDiagnostico: vi.fn(async () => ({})),
  guardarDiagnostico: vi.fn(async () => ({})),
}));
vi.mock('@/reparaciones/reparaciones.service', () => ({
  registrarHoras: vi.fn(async () => ({})),
  registrarParte: vi.fn(async () => ({})),
  marcarTarea: vi.fn(async () => ({})),
}));

const comoRol = (rol: string) => vi.mocked(usuarios.actorDelToken).mockResolvedValue(actorDe(rol));
const p = (codigo = 'OT-0001') => conParams({ codigo });

describe('/api/ordenes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('todos los roles listan; el service filtra según el actor', async () => {
    comoRol('mecanico');
    const r = await GET(peticion('/api/ordenes?estado=en_reparacion&abiertas=1'), conParams({}));
    expect(r.status).toBe(200);
    expect(ordenes.listarOrdenes).toHaveBeenCalledWith(expect.objectContaining({ rol: 'mecanico' }), {
      estado: 'en_reparacion',
      buscar: undefined,
      abiertas: true,
    });
  });

  it('un estado desconocido en el filtro responde 400', async () => {
    comoRol('recepcionista');
    expect((await GET(peticion('/api/ordenes?estado=perdido'), conParams({}))).status).toBe(400);
  });

  it('el mecánico no crea órdenes ni asigna (403)', async () => {
    comoRol('mecanico');
    expect((await POST(peticion('/api/ordenes', { metodo: 'POST', cuerpo: { placa: 'ABC123', motivo: 'Ruido' } }), conParams({}))).status).toBe(403);
    expect(
      (await asignar(peticion('/x', { metodo: 'POST', cuerpo: { mecanicoId: '7c9e6679-7425-40de-944b-e07fc1f90ae7', etapa: 'diagnostico' } }), p())).status,
    ).toBe(403);
    expect(ordenes.crearOrden).not.toHaveBeenCalled();
  });

  it('la recepcionista crea la orden (201)', async () => {
    comoRol('recepcionista');
    const r = await leer(await POST(peticion('/api/ordenes', { metodo: 'POST', cuerpo: { placa: 'abc123', motivo: 'Ruido al frenar' } }), conParams({})));
    expect(r.estado).toBe(201);
    expect(ordenes.crearOrden).toHaveBeenCalledWith(expect.anything(), { placa: 'ABC123', motivo: 'Ruido al frenar' });
  });

  it('cancelar exige motivo y lo pasa al service', async () => {
    comoRol('recepcionista');
    expect((await cancelar(peticion('/x', { metodo: 'POST', cuerpo: {} }), p())).status).toBe(400);
    await cancelar(peticion('/x', { metodo: 'POST', cuerpo: { motivo: 'El cliente desistió' } }), p('OT-0004'));
    expect(ordenes.cancelar).toHaveBeenCalledWith(expect.anything(), 'OT-0004', 'El cliente desistió');
  });

  it('el mecánico no puede aprobar ni cancelar', async () => {
    comoRol('mecanico');
    expect((await estado(peticion('/x', { metodo: 'POST', cuerpo: { estado: 'aprobado' } }), p())).status).toBe(403);
    expect((await cancelar(peticion('/x', { metodo: 'POST', cuerpo: { motivo: 'Porque sí' } }), p())).status).toBe(403);
  });
});

describe('/api/ordenes/:codigo/diagnostico y reparación', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el concesionario no ve diagnósticos (403)', async () => {
    comoRol('concesionario');
    expect((await verDiagnostico(peticion('/x'), p())).status).toBe(403);
  });

  it('el mecánico guarda el paso a paso validado', async () => {
    comoRol('mecanico');
    const cuerpo = {
      observaciones: 'Pastillas gastadas',
      tareas: [{ descripcion: 'Cambiar pastillas', horasEstimadas: 1, repuestos: [{ itemId: 4, cantidad: 1 }] }],
    };
    const r = await guardarDiagnostico(peticion('/x', { metodo: 'PUT', cuerpo }), p());
    expect(r.status).toBe(200);
    expect(diagnosticos.guardarDiagnostico).toHaveBeenCalledWith(
      expect.objectContaining({ rol: 'mecanico' }),
      'OT-0001',
      expect.objectContaining({ tareas: [expect.objectContaining({ valorServicio: 0, repuestos: [{ itemId: 4, cantidad: 1 }] })] }),
    );
  });

  it('un repuesto sin ítem ni descripción responde 400', async () => {
    comoRol('mecanico');
    const cuerpo = { tareas: [{ descripcion: 'Cambiar', horasEstimadas: 1, repuestos: [{ cantidad: 1 }] }] };
    const r = await leer(await guardarDiagnostico(peticion('/x', { metodo: 'PUT', cuerpo }), p()));
    expect(r.estado).toBe(400);
    expect(r.json.message).toContain('ítem del inventario o una descripción');
  });

  it('horas con fechas inválidas responden 400; válidas, 201', async () => {
    comoRol('mecanico');
    expect((await horas(peticion('/x', { metodo: 'POST', cuerpo: { inicio: 'hoy', fin: 'mañana' } }), p())).status).toBe(400);
    const r = await horas(
      peticion('/x', { metodo: 'POST', cuerpo: { inicio: '2026-10-22T08:00:00-05:00', fin: '2026-10-22T09:00:00-05:00' } }),
      p(),
    );
    expect(r.status).toBe(201);
  });

  it('registrar una parte usada pasa ítem y cantidad', async () => {
    comoRol('mecanico');
    await partes(peticion('/x', { metodo: 'POST', cuerpo: { itemId: 2, cantidad: 3 } }), p());
    expect(reparaciones.registrarParte).toHaveBeenCalledWith(expect.anything(), 'OT-0001', 2, 3);
  });

  it('marcar una tarea usa el id de la ruta', async () => {
    comoRol('mecanico');
    await tarea(peticion('/x', { metodo: 'PATCH', cuerpo: { completada: true } }), conParams({ codigo: 'OT-0001', id: '8' }));
    expect(reparaciones.marcarTarea).toHaveBeenCalledWith(expect.anything(), 'OT-0001', 8, true);
  });
});
