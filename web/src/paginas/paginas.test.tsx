import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { actorDe, orden, renderizar, reparacion, sede, sedeFrenos } from '../pruebas/utilidades';
import { destinoDe, MisTrabajos } from './MisTrabajos';
import { OrdenDetallePagina } from './OrdenDetalle';
import { ReparacionPagina } from './Reparacion';
import { cuerpoUsuario, Usuarios } from './Usuarios';

describe('mis trabajos (mecánico)', () => {
  it('a dónde lleva cada estado', () => {
    expect(destinoDe({ codigo: 'OT-1', estado: 'en_diagnostico' })).toBe('/ordenes/OT-1/diagnostico');
    expect(destinoDe({ codigo: 'OT-1', estado: 'en_reparacion' })).toBe('/ordenes/OT-1/reparacion');
    expect(destinoDe({ codigo: 'OT-1', estado: 'validando_garantia' })).toBe('/ordenes/OT-1');
  });

  it('muestra la cola de su sede y sus órdenes con el acceso a la etapa', async () => {
    renderizar(<MisTrabajos />, {
      actor: actorDe('mecanico'),
      rutas: {
        '/api/ordenes?vista=mias': [orden({ codigo: 'OT-0002', estado: 'en_diagnostico' })],
        '/api/ordenes?vista=cola': [orden({ codigo: 'OT-0003', por_garantia: true })],
      },
    });
    expect(await screen.findByText('1 orden mía')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Diagnosticar →' })).toHaveAttribute('href', '/ordenes/OT-0002/diagnostico');
    expect(await screen.findByRole('button', { name: 'Tomar y diagnosticar' })).toBeInTheDocument();
    expect(screen.getByText('Por garantía')).toBeInTheDocument();
  });

  it('tomar una orden de la cola la pide sin cuerpo y lleva al diagnóstico', async () => {
    const { llamadas } = renderizar(<MisTrabajos />, {
      actor: actorDe('mecanico'),
      ruta: '/mis-trabajos',
      patron: '/mis-trabajos',
      rutas: {
        '/api/ordenes?vista=mias': [],
        '/api/ordenes?vista=cola': [orden()],
        'POST /api/ordenes/OT-0001/tomar': orden({ estado: 'en_diagnostico' }),
        '/api/ordenes/OT-0001/diagnostico': { estado: 404, json: { message: 'x' } },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Tomar y diagnosticar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.url === '/api/ordenes/OT-0001/tomar')).toBe(true));
    expect(llamadas.find((l) => l.url.endsWith('/tomar'))?.cuerpo).toBeUndefined();
  });

  it('el administrador ve todas las órdenes abiertas, sin cola', async () => {
    const { llamadas } = renderizar(<MisTrabajos />, { actor: actorDe('administrador'), rutas: { '/api/ordenes?abiertas=1': [orden()] } });
    expect(await screen.findByText('Órdenes abiertas')).toBeInTheDocument();
    expect(screen.queryByText(/Cola de mi sede/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tomar/ })).not.toBeInTheDocument();
    expect(llamadas.some((l) => l.url === '/api/ordenes?vista=cola')).toBe(false);
  });
});

describe('detalle de la orden', () => {
  const abrir = (o: object, actor = actorDe('mecanico')) =>
    renderizar(<OrdenDetallePagina />, { actor, ruta: '/ordenes/OT-0001', patron: '/ordenes/:codigo', rutas: { '/api/ordenes/OT-0001': o } });

  it('muestra el vehículo por VIN, la garantía, los mensajes y el prediagnóstico', async () => {
    abrir(orden());
    expect(await screen.findByText('ABC123 · Mazda 3')).toBeInTheDocument();
    expect(screen.getByText(/VIN 9BWZZZ377VT004251/)).toBeInTheDocument();
    expect(screen.getByText('Garantía vigente')).toBeInTheDocument();
    expect(screen.getByText('«Chilla al frenar»')).toBeInTheDocument();
    expect(screen.getByText('Probable desgaste de pastillas')).toBeInTheDocument();
    expect(screen.getByText(/Un mecánico de la sede debe tomarla/)).toBeInTheDocument();
  });

  it('una orden por garantía muestra el motivo del reclamo', async () => {
    abrir(orden({ por_garantia: true, motivo_reclamo: 'Falla del caliper a los 8 meses' }));
    expect(await screen.findByText('Viene por garantía')).toBeInTheDocument();
    expect(screen.getByText('Falla del caliper a los 8 meses')).toBeInTheDocument();
  });

  it('el mecánico de la sede puede tomarla', async () => {
    abrir(orden());
    expect(await screen.findByRole('button', { name: 'Tomar y diagnosticar' })).toBeInTheDocument();
  });

  it('un mecánico de otra sede no ve el botón tomar', async () => {
    abrir(orden(), actorDe('mecanico', 'id-otro', 2));
    await screen.findByText('ABC123 · Mazda 3');
    expect(screen.queryByRole('button', { name: /Tomar/ })).not.toBeInTheDocument();
  });

  it('una orden remitida dice desde qué sede y con qué nota', async () => {
    abrir(orden({ estado: 'remitida', sede: sedeFrenos(), remitida_desde: { codigo: 'PL-CENTRO', nombre: 'Pulgas Locas Centro', nota: 'Ruido en la rueda delantera' } }), actorDe('mecanico', 'id-m', 2));
    expect(await screen.findByText('Remitida desde Pulgas Locas Centro')).toBeInTheDocument();
    expect(screen.getByText('Ruido en la rueda delantera')).toBeInTheDocument();
  });
});

describe('reparación', () => {
  const asignado = orden({ estado: 'en_reparacion', asignaciones: [{ id: 1, etapa: 'reparacion', mecanico_id: 'id-mecanico', mecanico: 'Ana Prueba' }] });
  const abrir = (rep: object, o: object = asignado, actor = actorDe('mecanico'), extra: Record<string, unknown> = {}) =>
    renderizar(<ReparacionPagina />, {
      actor,
      ruta: '/ordenes/OT-0001/reparacion',
      patron: '/ordenes/:codigo/reparacion',
      rutas: {
        '/api/ordenes/OT-0001/reparacion': rep,
        '/api/ordenes/OT-0001': o,
        ...extra,
      },
    });

  it('muestra la orden de compra de facturación y la mano de obra cotizada', async () => {
    abrir(reparacion());
    expect(await screen.findByText('Repuestos El Gato')).toBeInTheDocument();
    expect(screen.getAllByText('PAS-DEL-CER').length).toBeGreaterThan(0);
    expect(screen.getByText(/cotizada/)).toHaveTextContent('90.000');
  });

  it('sin horas ni servicios hechos no se puede terminar', async () => {
    abrir(reparacion());
    expect(await screen.findByRole('button', { name: 'Terminar reparación' })).toBeDisabled();
    expect(screen.getByText(/registre las horas y marque los servicios/)).toBeInTheDocument();
  });

  it('con horas y un servicio hecho termina y queda pendiente de facturación', async () => {
    const lista = reparacion({
      servicios: [{ ...reparacion().servicios[0], completada: true }],
      horas: [{ id: 1, mecanico: 'Ana Prueba', mecanico_id: 'id-mecanico', tarea_id: 11, inicio: '2026-10-23T13:00:00Z', fin: '2026-10-23T14:30:00Z', horas: 1.5, nota: '' }],
      control: { horas_estandar: 1.5, horas_reales: 1.5, eficiencia: 1 },
    });
    const { llamadas } = abrir(lista, asignado, actorDe('mecanico'), {
      'POST /api/ordenes/OT-0001/reparacion/terminar': { ...lista, estado: 'terminada', estado_orden: 'pendiente_facturacion' },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Terminar reparación' }));
    expect(await screen.findByText(/facturación envía el PSE/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST' && l.url.endsWith('/terminar'))).toBe(true);
  });

  it('marcar un servicio hecho llama a la API con el id de la tarea', async () => {
    const { llamadas } = abrir(reparacion(), asignado, actorDe('mecanico'), {
      'PATCH /api/ordenes/OT-0001/reparacion/tareas/11': reparacion({ servicios: [{ ...reparacion().servicios[0], completada: true }] }),
    });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Cambio de pastillas delanteras hecho' }));
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ completada: true }));
  });

  it('una parte de la compra se registra como usada con su código y la compra', async () => {
    const { llamadas } = abrir(reparacion(), asignado, actorDe('mecanico'), {
      'POST /api/ordenes/OT-0001/reparacion/partes': reparacion(),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Usada' }));
    expect(screen.getByLabelText('SKU de la tienda')).toHaveValue('PAS-DEL-CER');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parte usada' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'POST' && l.url.endsWith('/partes'))?.cuerpo).toEqual({
        codigoRepuesto: 'PAS-DEL-CER',
        descripcion: 'Pastillas delanteras cerámicas',
        cantidad: 1,
        compraId: 5,
        nota: '',
      }),
    );
  });

  it('una parte escrita a mano se registra sin compra', async () => {
    const { llamadas } = abrir(reparacion({ orden_compra: [] }), asignado, actorDe('mecanico'), {
      'POST /api/ordenes/OT-0001/reparacion/partes': reparacion(),
    });
    expect(await screen.findByText('Sin repuestos que comprar: solo mano de obra')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('SKU de la tienda'), 'pas-del-cer');
    // Sin orden de compra no hay sugerencia: la API toma la descripción del diagnóstico.
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parte usada' }));
    await waitFor(() => expect(llamadas.find((l) => l.url.endsWith('/partes'))?.cuerpo).toEqual({ codigoRepuesto: 'PAS-DEL-CER', cantidad: 1, nota: '' }));
  });

  it('un mecánico no asignado a la reparación solo la consulta', async () => {
    abrir(reparacion(), orden({ estado: 'en_reparacion', asignaciones: [{ id: 1, etapa: 'reparacion', mecanico_id: 'otro', mecanico: 'Luis' }] }));
    expect(await screen.findByText('Repuestos El Gato')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminar reparación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar horas' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Cambio de pastillas delanteras hecho' })).toBeDisabled();
  });
});

describe('usuarios (administrador)', () => {
  const usuarios = [
    { id: 'u1', nombre: 'Mario', apellido: 'Gómez', documento: '10101', telefono: '3001234567', usuario: 'mario', rol: 'mecanico', taller: { id: 1, codigo: 'PL-CENTRO', nombre: 'Pulgas Locas Centro' }, activo: true },
    { id: 'u2', nombre: 'Agente', apellido: 'Concesionario', documento: '20202', telefono: '3007654321', usuario: 'agente-concesionario', rol: 'agente', taller: null, activo: true },
  ];
  const abrir = (extra: Record<string, unknown> = {}) =>
    renderizar(<Usuarios />, { actor: actorDe('administrador'), rutas: { '/api/usuarios': usuarios, '/api/talleres': [sede(), sedeFrenos()], ...extra } });

  it('la sede solo viaja para el mecánico', () => {
    expect(cuerpoUsuario({ usuario: 'a', rol: 'mecanico', tallerId: '2' })).toEqual({ usuario: 'a', rol: 'mecanico', tallerId: 2 });
    expect(cuerpoUsuario({ usuario: 'a', rol: 'agente', tallerId: '2' })).toEqual({ usuario: 'a', rol: 'agente' });
  });

  it('muestra la sede del mecánico; los demás roles ven todas', async () => {
    abrir();
    expect(await screen.findByLabelText('Sede de mario')).toHaveValue('1');
    expect(screen.getByText('Todas')).toBeInTheDocument();
  });

  it('los roles son los tres fijos, sin pedirlos a la API', async () => {
    const { llamadas } = abrir();
    const select = await screen.findByLabelText('Rol de mario');
    expect([...select.querySelectorAll('option')].map((o) => o.value)).toEqual(['administrador', 'mecanico', 'agente']);
    expect(llamadas.some((l) => l.url === '/api/roles')).toBe(false);
  });

  it('crear un mecánico exige elegir la sede y la envía', async () => {
    const { llamadas } = abrir({ 'POST /api/usuarios': { id: 'u3' } });
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Luis');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Pérez');
    await userEvent.type(screen.getByLabelText('Documento'), '30303');
    await userEvent.type(screen.getByLabelText('Teléfono'), '3000000000');
    await userEvent.type(screen.getByLabelText('Usuario'), 'luis');
    await userEvent.type(screen.getByLabelText(/^Clave/), 'clave-segura-1');
    await userEvent.selectOptions(screen.getByLabelText('Sede'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({ usuario: 'luis', rol: 'mecanico', tallerId: 2 }));
  });

  it('un agente no lleva sede', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'agente');
    expect(screen.queryByLabelText('Sede')).not.toBeInTheDocument();
  });

  it('cambiar la sede de un mecánico envía el tallerId', async () => {
    const { llamadas } = abrir({ 'PATCH /api/usuarios/u1': { ...usuarios[0] } });
    await userEvent.selectOptions(await screen.findByLabelText('Sede de mario'), '2');
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ tallerId: 2 }));
  });

  it('pasar un agente a mecánico le propone la primera sede', async () => {
    const { llamadas } = abrir({ 'PATCH /api/usuarios/u2': { ...usuarios[1] } });
    await userEvent.selectOptions(await screen.findByLabelText('Rol de agente-concesionario'), 'mecanico');
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ rol: 'mecanico', tallerId: 1 }));
  });
});
