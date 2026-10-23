import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Diagnostico, Item } from '../api/tipos';
import { actorDe, orden, renderizar } from '../pruebas/utilidades';
import { aCuerpo, DiagnosticoPagina, EditorDiagnostico } from './Diagnostico';

const items: Item[] = [
  { id: 1, codigo: 'ACE-5W30', nombre: 'Aceite 5W-30', precio: 38000, cantidad: 24, nivelAlerta: 8, categoria: 'Lubricantes', categoriaId: 1, activo: true, enAlerta: false },
  { id: 2, codigo: 'FIL-ACE-01', nombre: 'Filtro de aceite', precio: 25000, cantidad: 0, nivelAlerta: 4, categoria: 'Filtros', categoriaId: 2, activo: true, enAlerta: true },
];

const borrador = (cambios: Partial<Diagnostico> = {}): Diagnostico => ({
  orden: 'OT-0001',
  estadoOrden: 'en_diagnostico',
  estado: 'borrador',
  mecanico: 'Mario Prueba',
  observaciones: '',
  tarifaHora: 60000,
  finalizadoEn: null,
  tareas: [],
  costo: { horas: 0, manoObra: 0, servicios: 0, repuestos: 0, total: 0 },
  ...cambios,
});

const total = () => screen.getByTestId('total').textContent?.replace(/\s/g, ' ');

describe('editor del diagnóstico', () => {
  it('empieza con un paso de 1 hora y calcula la mano de obra', () => {
    render(<EditorDiagnostico inicial={borrador()} items={items} tarifaEditable={false} alGuardar={vi.fn()} alFinalizar={vi.fn()} />);
    expect(screen.getAllByText(/^Paso \d$/)).toHaveLength(1);
    expect(total()).toMatch(/60\.000/);
  });

  it('el costo se actualiza en vivo con horas, servicio y repuestos del inventario', async () => {
    render(<EditorDiagnostico inicial={borrador()} items={items} tarifaEditable={false} alGuardar={vi.fn()} alFinalizar={vi.fn()} />);
    const valor = screen.getByLabelText('Valor del servicio');
    await userEvent.clear(valor);
    await userEvent.type(valor, '20000');
    await userEvent.click(screen.getByRole('button', { name: '+ Del inventario' }));
    const cantidad = screen.getByLabelText('Cantidad');
    await userEvent.clear(cantidad);
    await userEvent.type(cantidad, '4');
    // 1 h × 60.000 + 20.000 + 4 × 38.000 = 232.000
    expect(total()).toMatch(/232\.000/);
  });

  it('avisa cuando una pieza del inventario no alcanza', async () => {
    render(<EditorDiagnostico inicial={borrador()} items={items} tarifaEditable={false} alGuardar={vi.fn()} alFinalizar={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '+ Del inventario' }));
    await userEvent.selectOptions(screen.getByLabelText('Ítem del inventario'), '2');
    expect(screen.getByText('No alcanza: se pedirá')).toBeInTheDocument();
  });

  it('agrega, reordena y quita pasos', async () => {
    render(<EditorDiagnostico inicial={borrador()} items={items} tarifaEditable={false} alGuardar={vi.fn()} alFinalizar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Qué hacer'), 'Primero');
    await userEvent.click(screen.getByRole('button', { name: '+ Agregar paso' }));
    const pasos = () => within(screen.getByRole('list', { name: 'Paso a paso' })).getAllByRole('listitem');
    expect(pasos()).toHaveLength(2);
    await userEvent.type(within(pasos()[1]).getByLabelText('Qué hacer'), 'Segundo');
    await userEvent.click(screen.getByRole('button', { name: 'Subir paso 2' }));
    expect(within(pasos()[0]).getByLabelText('Qué hacer')).toHaveValue('Segundo');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar paso 1' }));
    expect(pasos()).toHaveLength(1);
    expect(within(pasos()[0]).getByLabelText('Qué hacer')).toHaveValue('Primero');
  });

  it('el mecánico no cambia la tarifa; el personal sí', () => {
    const { unmount } = render(<EditorDiagnostico inicial={borrador()} items={items} tarifaEditable={false} alGuardar={vi.fn()} alFinalizar={vi.fn()} />);
    expect(screen.getByLabelText('Tarifa por hora')).toBeDisabled();
    unmount();
    render(<EditorDiagnostico inicial={borrador()} items={items} tarifaEditable alGuardar={vi.fn()} alFinalizar={vi.fn()} />);
    expect(screen.getByLabelText('Tarifa por hora')).toBeEnabled();
  });

  it('guardar envía el paso a paso sin la tarifa si no es editable', async () => {
    const alGuardar = vi.fn(async () => {});
    render(<EditorDiagnostico inicial={borrador()} items={items} tarifaEditable={false} alGuardar={alGuardar} alFinalizar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Qué hacer'), 'Cambiar pastillas');
    await userEvent.click(screen.getByRole('button', { name: '+ Pieza que no hay' }));
    await userEvent.type(screen.getByLabelText('Pieza fuera de inventario'), 'Sensor');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(alGuardar).toHaveBeenCalledWith({
      observaciones: '',
      tareas: [
        {
          descripcion: 'Cambiar pastillas',
          horasEstimadas: 1,
          valorServicio: 0,
          requierePiezas: true,
          repuestos: [{ descripcion: 'Sensor', cantidad: 1, precioUnitario: 0 }],
        },
      ],
    });
    expect(await screen.findByText('Borrador guardado.')).toBeInTheDocument();
  });

  it('finalizar guarda primero y luego finaliza; un error se muestra', async () => {
    const orden: string[] = [];
    const alGuardar = vi.fn(async () => void orden.push('guardar'));
    const alFinalizar = vi.fn(async () => {
      orden.push('finalizar');
      throw new Error('El diagnóstico necesita al menos un paso');
    });
    render(<EditorDiagnostico inicial={borrador()} items={items} tarifaEditable={false} alGuardar={alGuardar} alFinalizar={alFinalizar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y finalizar diagnóstico' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos un paso');
    expect(orden).toEqual(['guardar', 'finalizar']);
  });

  it('aCuerpo manda solo itemId y cantidad para ítems del inventario', () => {
    expect(
      aCuerpo([
        {
          clave: 'a',
          descripcion: ' Cambio ',
          horasEstimadas: '1.5',
          valorServicio: '',
          repuestos: [{ clave: 'b', itemId: 3, descripcion: 'x', cantidad: '2', precioUnitario: '999' }],
        },
      ]),
    ).toEqual([{ descripcion: 'Cambio', horasEstimadas: 1.5, valorServicio: 0, requierePiezas: true, repuestos: [{ itemId: 3, cantidad: 2 }] }]);
  });
});

describe('página del diagnóstico', () => {
  const rutas = (diag: Diagnostico, asignado: boolean) => ({
    '/api/ordenes/OT-0001/diagnostico': diag,
    '/api/ordenes/OT-0001': orden({
      estado: diag.estadoOrden,
      asignaciones: asignado ? [{ id: 1, etapa: 'diagnostico', mecanicoId: 'id-mecanico', mecanico: 'Mario' }] : [],
    }),
    '/api/inventario': items,
  });
  const opciones = (rol: string, diag: Diagnostico, asignado: boolean) => ({
    ruta: '/ordenes/OT-0001/diagnostico',
    patron: '/ordenes/:codigo/diagnostico',
    actor: actorDe(rol),
    rutas: rutas(diag, asignado),
  });

  it('el mecánico asignado edita el borrador', async () => {
    renderizar(<DiagnosticoPagina />, opciones('mecanico', borrador(), true));
    expect(await screen.findByRole('button', { name: 'Guardar borrador' })).toBeInTheDocument();
  });

  it('la recepcionista solo lo lee, con el costo para el cliente', async () => {
    const d = borrador({
      estadoOrden: 'diagnosticado',
      estado: 'finalizado',
      tareas: [{ id: 1, posicion: 1, descripcion: 'Cambiar filtro', horasEstimadas: 1, valorServicio: 0, requierePiezas: true, repuestos: [{ id: 1, itemId: 2, codigo: 'FIL-ACE-01', descripcion: 'Filtro de aceite', cantidad: 1, precioUnitario: 25000, disponible: false }] }],
      costo: { horas: 1, manoObra: 60000, servicios: 0, repuestos: 25000, total: 85000 },
    });
    renderizar(<DiagnosticoPagina />, opciones('recepcionista', d, false));
    expect(await screen.findByText('Cambiar filtro')).toBeInTheDocument();
    expect(screen.getByText('Pedir')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
  });

  it('un mecánico no asignado a diagnóstico no puede editar', async () => {
    renderizar(<DiagnosticoPagina />, opciones('mecanico', borrador(), false));
    await waitFor(() => expect(screen.getByText('Diagnóstico')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
  });
});
