import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { actorDe, orden, renderizar } from '../pruebas/utilidades';
import { Inventario } from './Inventario';
import { MisTrabajos } from './MisTrabajos';
import { etapaAsignable, OrdenDetallePagina } from './OrdenDetalle';
import { Ordenes } from './Ordenes';
import { ReparacionPagina } from './Reparacion';

const items = [
  { id: 1, codigo: 'BAT-12V', nombre: 'Batería', precio: 420000, cantidad: 1, nivelAlerta: 1, categoria: 'Eléctrico', categoriaId: 5, activo: true, enAlerta: true },
  { id: 2, codigo: 'BUJ-01', nombre: 'Bujía', precio: 35000, cantidad: 16, nivelAlerta: 8, categoria: 'Motor', categoriaId: 6, activo: true, enAlerta: false },
];

describe('mis trabajos (mecánico)', () => {
  it('muestra los carros asignados con el acceso a la etapa en curso', async () => {
    renderizar(<MisTrabajos />, {
      actor: actorDe('mecanico'),
      rutas: {
        '/api/ordenes': [orden({ codigo: 'OT-0001', estado: 'en_diagnostico' }), orden({ codigo: 'OT-0002', estado: 'en_reparacion', vehiculo: { ...orden().vehiculo, placa: 'XYZ987' } })],
      },
    });
    expect(await screen.findByText('2 carros asignados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Diagnóstico →' })).toHaveAttribute('href', '/ordenes/OT-0001/diagnostico');
    expect(screen.getByRole('link', { name: 'Reparación →' })).toHaveAttribute('href', '/ordenes/OT-0002/reparacion');
  });

  it('pide solo las órdenes abiertas', async () => {
    const { llamadas } = renderizar(<MisTrabajos />, { actor: actorDe('mecanico'), rutas: { '/api/ordenes': [] } });
    expect(await screen.findByText('No tiene carros asignados por ahora.')).toBeInTheDocument();
    expect(screen.getByText('0 carros asignados')).toBeInTheDocument();
    expect(llamadas.some((l) => l.url === '/api/ordenes?abiertas=1')).toBe(true);
  });
});

describe('órdenes', () => {
  it('la recepcionista abre una orden nueva', async () => {
    const { llamadas } = renderizar(<Ordenes />, {
      actor: actorDe('recepcionista'),
      rutas: { 'GET /api/ordenes': [], 'POST /api/ordenes': orden({ codigo: 'OT-0009' }) },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva orden' }));
    await userEvent.type(screen.getByLabelText('Placa'), 'abc123');
    await userEvent.type(screen.getByLabelText('Motivo de ingreso'), 'Ruido al frenar');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir orden' }));
    const post = llamadas.find((l) => l.metodo === 'POST');
    expect(post?.cuerpo).toEqual({ placa: 'abc123', motivo: 'Ruido al frenar' });
  });

  it('si el vehículo no existe ofrece registrarlo', async () => {
    renderizar(<Ordenes />, {
      actor: actorDe('recepcionista'),
      rutas: { 'GET /api/ordenes': [], 'POST /api/ordenes': { estado: 404, json: { message: 'No existe un vehículo con la placa ABC123. Regístrelo primero' } } },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva orden' }));
    await userEvent.type(screen.getByLabelText('Placa'), 'ABC123');
    await userEvent.type(screen.getByLabelText('Motivo de ingreso'), 'Revisión');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir orden' }));
    expect(await screen.findByRole('link', { name: 'Registrar cliente y vehículo' })).toHaveAttribute('href', '/clientes');
  });

  it('el mecánico no ve el botón de nueva orden', async () => {
    renderizar(<Ordenes />, { actor: actorDe('mecanico'), rutas: { '/api/ordenes': [orden()] } });
    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva orden' })).not.toBeInTheDocument();
  });
});

describe('detalle de la orden', () => {
  it('etapa asignable según el estado', () => {
    expect(etapaAsignable('recibido')).toBe('diagnostico');
    expect(etapaAsignable('aprobado')).toBe('reparacion');
    expect(etapaAsignable('diagnosticado')).toBeNull();
    expect(etapaAsignable('entregado')).toBeNull();
  });

  const montar = (rol: string, cambios: Record<string, unknown>, rutas: Record<string, unknown> = {}) =>
    renderizar(<OrdenDetallePagina />, {
      ruta: '/ordenes/OT-0001',
      patron: '/ordenes/:codigo',
      actor: actorDe(rol),
      rutas: {
        'GET /api/ordenes/OT-0001': orden(cambios),
        '/api/mecanicos/disponibilidad': [{ id: 'm1', nombre: 'Mario Prueba', carga: 0, disponible: true, ordenes: [] }],
        ...rutas,
      },
    });

  it('la recepcionista asigna un mecánico a una orden recibida', async () => {
    const { llamadas } = montar('recepcionista', {}, { 'POST /api/ordenes/OT-0001/asignaciones': orden({ estado: 'en_diagnostico' }) });
    const selector = await screen.findByLabelText(/Asignar mecánico/);
    await screen.findByRole('option', { name: /Mario Prueba — disponible/ });
    await userEvent.selectOptions(selector, 'm1');
    await userEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({ mecanicoId: 'm1', etapa: 'diagnostico' });
    expect(await screen.findAllByText('En diagnóstico')).not.toHaveLength(0);
    // Limpia la elección y vuelve a pedir la disponibilidad.
    expect(selector).toHaveValue('');
    expect(llamadas.filter((l) => l.url === '/api/mecanicos/disponibilidad')).toHaveLength(2);
  });

  it('con el diagnóstico listo ofrece aprobar con el costo', async () => {
    montar('recepcionista', { estado: 'diagnosticado', diagnostico: { estado: 'finalizado', mecanico: 'Mario', tareas: 2, costo: { horas: 1, manoObra: 60000, servicios: 0, repuestos: 0, total: 60000 } } });
    expect(await screen.findByRole('button', { name: 'El cliente aprobó' })).toBeInTheDocument();
  });

  it('cancelar pide el motivo antes de confirmar', async () => {
    const { llamadas } = montar('recepcionista', { estado: 'en_reparacion' }, { 'POST /api/ordenes/OT-0001/cancelar': orden({ estado: 'cancelado' }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar reparación' }));
    await userEvent.type(screen.getByLabelText('Motivo de la cancelación'), 'El cliente desistió');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(llamadas.find((l) => l.url.endsWith('/cancelar'))?.cuerpo).toEqual({ motivo: 'El cliente desistió' });
  });

  it('el mecánico ve la orden sin acciones de recepción', async () => {
    montar('mecanico', { estado: 'en_diagnostico' });
    expect(await screen.findByText('Línea de tiempo')).toBeInTheDocument();
    expect(screen.queryByText('Acciones')).not.toBeInTheDocument();
  });
});

describe('inventario', () => {
  it('marca los ítems en alerta y el mecánico no puede crear', async () => {
    renderizar(<Inventario />, { actor: actorDe('mecanico'), rutas: { '/api/inventario': items, '/api/categorias': [] } });
    const fila = (await screen.findByText('Batería')).closest('tr')!;
    expect(within(fila).getByText('Alerta')).toHaveAttribute('data-tono', 'alerta');
    expect(screen.getByText('1 ítem en alerta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo ítem' })).not.toBeInTheDocument();
  });

  it('la recepcionista registra una entrada de mercancía', async () => {
    const { llamadas } = renderizar(<Inventario />, {
      actor: actorDe('recepcionista'),
      rutas: { 'GET /api/inventario': items, '/api/categorias': [], 'POST /api/inventario/1/movimientos': items[0] },
    });
    await userEvent.click(await screen.findByText('Batería'));
    await userEvent.type(screen.getByLabelText('Cantidad'), '5');
    await userEvent.type(screen.getByLabelText('Nota'), 'Factura 120');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar movimiento' }));
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toEqual({ tipo: 'entrada', cantidad: 5, nota: 'Factura 120' });
  });

  it('el filtro de alertas viaja en la consulta', async () => {
    const { llamadas } = renderizar(<Inventario />, { ruta: '/inventario?alertas=1', actor: actorDe('recepcionista'), rutas: { '/api/inventario': [items[0]], '/api/categorias': [] } });
    await screen.findByText('Batería');
    expect(llamadas.some((l) => l.url === '/api/inventario?alertas=1')).toBe(true);
  });
});

describe('reparación', () => {
  const rep = {
    orden: 'OT-0001',
    estadoOrden: 'en_reparacion',
    estado: 'en_curso',
    iniciadaEn: '2026-10-22T13:00:00Z',
    terminadaEn: null,
    tarifaHora: 60000,
    tareas: [{ id: 7, posicion: 1, descripcion: 'Cambiar aceite', horasEstimadas: 1, valorServicio: 30000, completada: false }],
    horas: [],
    partes: [],
    estimado: { horas: 1, manoObra: 60000, servicios: 30000, repuestos: 0, total: 90000 },
    real: { horas: 0, manoObra: 0, servicios: 0, repuestos: 0, total: 0 },
    diferencia: -90000,
  };
  const montar = (asignado: boolean, rutas: Record<string, unknown> = {}) =>
    renderizar(<ReparacionPagina />, {
      ruta: '/ordenes/OT-0001/reparacion',
      patron: '/ordenes/:codigo/reparacion',
      actor: actorDe('mecanico'),
      rutas: {
        'GET /api/ordenes/OT-0001/reparacion': rep,
        '/api/ordenes/OT-0001': orden({ estado: 'en_reparacion', asignaciones: asignado ? [{ id: 2, etapa: 'reparacion', mecanicoId: 'id-mecanico', mecanico: 'Mario' }] : [] }),
        '/api/inventario': items,
        ...rutas,
      },
    });

  it('el mecánico asignado registra horas; sin horas no puede terminar', async () => {
    const { llamadas } = montar(true, { 'POST /api/ordenes/OT-0001/reparacion/horas': { ...rep, horas: [{ id: 1, mecanico: 'Mario', mecanicoId: 'id-mecanico', tareaId: null, inicio: '2026-10-22T13:00:00Z', fin: '2026-10-22T15:00:00Z', horas: 2, nota: '' }] } });
    expect(await screen.findByRole('button', { name: 'Terminar reparación' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar horas' }));
    const post = llamadas.find((l) => l.url.endsWith('/horas'));
    expect(post?.cuerpo).toMatchObject({ inicio: expect.stringMatching(/Z$/), fin: expect.stringMatching(/Z$/), nota: '' });
    expect(await screen.findByRole('button', { name: 'Terminar reparación' })).toBeEnabled();
  });

  it('marcar un paso hecho llama a la API con el id del paso', async () => {
    const { llamadas } = montar(true, { 'PATCH /api/ordenes/OT-0001/reparacion/tareas/7': { ...rep, tareas: [{ ...rep.tareas[0], completada: true }] } });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Paso 1 hecho' }));
    expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ completada: true });
  });

  it('un mecánico no asignado a la reparación solo la consulta', async () => {
    montar(false);
    expect(await screen.findByRole('checkbox', { name: 'Paso 1 hecho' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Registrar horas' })).not.toBeInTheDocument();
  });
});
