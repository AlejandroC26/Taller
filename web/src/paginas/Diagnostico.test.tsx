import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BusquedaRepuestos, Diagnostico, Sede, Servicio, ServicioDiagnostico } from '../api/tipos';
import { actorDe, catalogo as catalogoPrueba, diagnostico, orden, renderizar, sede, sedeFrenos, servicioDiagnostico } from '../pruebas/utilidades';
import { aCuerpo, aFormulario, DiagnosticoPagina, EditorDiagnostico } from './Diagnostico';
import type { FiltroRepuestos } from './Diagnostico';

const catalogo = catalogoPrueba as Servicio[];
const busqueda = (cambios: Partial<BusquedaRepuestos> = {}): BusquedaRepuestos => ({
  orden: 'OT-0001',
  tiendas: ['Tienda de repuestos'],
  sin_respuesta: [],
  actualizado_en: '2026-10-31T19:00:00.000Z',
  categorias: ['Frenos', 'Suspensión'],
  repuestos: [
    {
      codigo_repuesto: 'PAS-DEL-CER',
      nombre: 'Juego de pastillas delanteras cerámicas',
      categoria: 'Frenos',
      marcas: ['Bosch', 'Brembo'],
      unidades_disponibles: 1,
      tiendas: ['Tienda de repuestos'],
    },
  ],
  ...cambios,
});
const diag = (cambios: Record<string, unknown> = {}) => diagnostico(cambios) as Diagnostico;
const servicio = (cambios: Record<string, unknown> = {}) => servicioDiagnostico(cambios) as ServicioDiagnostico;

function editor(props: Partial<Parameters<typeof EditorDiagnostico>[0]> = {}) {
  const funciones = {
    alGuardar: vi.fn(async () => diag({ servicios: [servicio()] })),
    alFinalizar: vi.fn(async () => undefined),
    alRemitir: vi.fn(async () => undefined),
    alSubir: vi.fn(async () => ({ id: 7, nombre: 'foto.jpg', tipo: 'jpg', url: '/api/evidencias/7' })),
    buscarRepuestos: vi.fn(async (_filtro: FiltroRepuestos) => busqueda()),
  };
  render(<EditorDiagnostico inicial={diag()} catalogo={catalogo} sedesRemision={[]} {...funciones} {...props} />);
  return { ...funciones, ...props };
}

describe('editor del diagnóstico', () => {
  it('empieza con un servicio vacío y la mano de obra en 0', () => {
    editor();
    expect(screen.getAllByLabelText('Servicio (SKU)')).toHaveLength(1);
    expect(screen.getByTestId('total')).toHaveTextContent(/\$\s?0/);
  });

  it('la mano de obra es el precio fijo de cada SKU, en vivo', async () => {
    editor();
    await userEvent.selectOptions(screen.getByLabelText('Servicio (SKU)'), 'FRE-PAST-DEL');
    expect(screen.getByTestId('total')).toHaveTextContent('90.000');
    await userEvent.click(screen.getByRole('button', { name: '+ Agregar servicio' }));
    await userEvent.selectOptions(screen.getAllByLabelText('Servicio (SKU)')[1], 'MOT-AFINACION');
    expect(screen.getByTestId('total')).toHaveTextContent('270.000');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar servicio 1' }));
    expect(screen.getByTestId('total')).toHaveTextContent('180.000');
  });

  it('la revisión general ya hecha se suma y no se puede editar', () => {
    editor({ inicial: diag({ servicios: [servicio({ id: 1, sku: 'REV-GENERAL', servicio: 'Revisión general', precio: 60000, fija: true, completada: true })] }) });
    expect(screen.getByText('Revisión general')).toBeInTheDocument();
    expect(screen.getByText(/Hecha/)).toHaveTextContent('60.000');
    expect(screen.getAllByLabelText('Servicio (SKU)')).toHaveLength(1);
    expect(screen.getByTestId('total')).toHaveTextContent('60.000');
  });

  it('la causa sugiere el dictamen de garantía y el mecánico lo puede cambiar', async () => {
    editor();
    const siAplica = () => screen.getByRole('radio', { name: 'Sí aplica' });
    await userEvent.selectOptions(screen.getByLabelText('Causa de la falla'), 'defecto_fabrica');
    expect(siAplica()).toBeChecked();
    await userEvent.selectOptions(screen.getByLabelText('Causa de la falla'), 'manipulacion_cliente');
    expect(screen.getByRole('radio', { name: 'No aplica' })).toBeChecked();
    await userEvent.click(siAplica());
    expect(screen.getByText(/Cambió el dictamen sugerido/)).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo del dictamen')).toBeInTheDocument();
  });

  it('sin id todavía no se pueden adjuntar evidencias', async () => {
    editor();
    await userEvent.selectOptions(screen.getByLabelText('Causa de la falla'), 'defecto_fabrica');
    expect(screen.getByRole('button', { name: 'Adjuntar foto o PDF' })).toBeDisabled();
    expect(screen.getByText('Guarde el borrador para adjuntar evidencias')).toBeInTheDocument();
  });

  it('adjunta una evidencia al servicio guardado', async () => {
    const f = editor({ inicial: diag({ servicios: [servicio({ causa: 'defecto_fabrica', garantia: { aplica: true, motivo: 'Fisura de fábrica', valida: null, respuesta: null, pagador: 'cliente' } })] }) });
    expect(screen.getByText('Si aplica garantía, la evidencia es obligatoria')).toBeInTheDocument();
    const archivo = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Adjuntar foto o PDF'), archivo);
    await waitFor(() => expect(f.alSubir).toHaveBeenCalledWith(11, archivo));
    expect(await screen.findByRole('button', { name: /foto\.jpg/ })).toBeInTheDocument();
  });

  it('una orden por garantía pide evidencias de la orden', async () => {
    const f = editor({ inicial: diag({ por_garantia: true }) });
    await userEvent.upload(screen.getByLabelText('Adjuntar evidencia de la orden'), new File(['x'], 'reclamo.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(f.alSubir).toHaveBeenCalledWith(null, expect.any(File)));
  });

  it('el repuesto se elige del catálogo de la tienda por código universal, sin precio', async () => {
    const f = editor();
    await userEvent.selectOptions(screen.getByLabelText('Servicio (SKU)'), 'FRE-PAST-DEL');
    await userEvent.click(screen.getByRole('button', { name: '+ Repuesto' }));
    // Al abrir se carga el catálogo completo.
    await waitFor(() => expect(f.buscarRepuestos).toHaveBeenCalledWith({ texto: '', categoria: '' }));
    await userEvent.selectOptions(await screen.findByLabelText('Categoría'), 'Frenos');
    expect(f.buscarRepuestos).toHaveBeenLastCalledWith({ texto: '', categoria: 'Frenos' });
    await userEvent.type(screen.getByLabelText('Buscar repuesto'), 'pastillas');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar en la tienda' }));
    expect(f.buscarRepuestos).toHaveBeenLastCalledWith({ texto: 'pastillas', categoria: 'Frenos' });
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('Bosch, Brembo')).toBeInTheDocument();
    expect(within(tabla).queryByText(/\$/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar Juego de pastillas delanteras cerámicas' }));
    // Elegirlo otra vez suma una unidad en la misma línea; pasa de lo disponible y lo avisa.
    await userEvent.click(screen.getByRole('button', { name: 'Agregar Juego de pastillas delanteras cerámicas' }));
    const elegidos = screen.getByRole('list', { name: 'Repuestos del servicio 1' });
    expect(within(elegidos).getByText('PAS-DEL-CER')).toBeInTheDocument();
    expect(within(elegidos).getByLabelText('Cantidad')).toHaveValue(2);
    expect(within(elegidos).getByText(/La tienda tiene 1 disponibles/)).toBeInTheDocument();
    expect(screen.getByText('1 por cotizar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(f.alGuardar).toHaveBeenCalled());
    expect(f.alGuardar).toHaveBeenCalledWith({
      observaciones: '',
      tareas: [{ sku: 'FRE-PAST-DEL', descripcion: '', causa: null, garantiaAplica: false, garantiaMotivo: '', repuestos: [{ codigoRepuesto: 'PAS-DEL-CER', cantidad: 2 }] }],
    });
    expect(await screen.findByText('Borrador guardado.')).toBeInTheDocument();
  });

  it('si la tienda no respondió avisa que es el último catálogo y permite actualizar', async () => {
    const buscarRepuestos = vi.fn(async (filtro: FiltroRepuestos) => busqueda(filtro.refrescar ? {} : { sin_respuesta: ['Tienda de repuestos'] }));
    editor({ buscarRepuestos });
    await userEvent.click(screen.getByRole('button', { name: '+ Repuesto' }));
    expect(await screen.findByText(/No respondió: Tienda de repuestos/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(buscarRepuestos).toHaveBeenLastCalledWith({ texto: '', categoria: '', refrescar: true }));
    expect(await screen.findByText(/Catálogo de las/)).toBeInTheDocument();
  });

  it('finalizar guarda primero y luego finaliza; un error se muestra', async () => {
    const f = editor({ alFinalizar: vi.fn(async () => Promise.reject(new Error('Falta la evidencia del servicio 1'))) });
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar y enviar a garantía' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falta la evidencia del servicio 1');
    expect(f.alGuardar).toHaveBeenCalled();
    expect(f.alFinalizar).toHaveBeenCalled();
  });

  it('remitir exige sede y una nota', async () => {
    const f = editor({ sedesRemision: [sedeFrenos() as Sede] });
    await userEvent.click(screen.getByRole('button', { name: 'Remitir a sede especializada' }));
    const remitir = screen.getByRole('button', { name: 'Remitir' });
    expect(remitir).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Sede'), '2');
    await userEvent.type(screen.getByLabelText('Nota para el especialista'), 'Ruido en la rueda delantera');
    await userEvent.click(remitir);
    await waitFor(() => expect(f.alRemitir).toHaveBeenCalledWith(2, 'Ruido en la rueda delantera'));
  });
});

describe('conversión del formulario', () => {
  it('aFormulario deja fuera las tareas fijas', () => {
    const f = aFormulario([
      servicio({ id: 1, fija: true }),
      servicio({
        id: 2,
        causa: 'desgaste_normal',
        repuestos: [{ id: 3, codigo_repuesto: 'PAS-DEL-CER', descripcion: 'Pastillas', categoria: 'Frenos', cantidad: 2 }],
      }),
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ id: 2, causa: 'desgaste_normal', repuestos: [{ codigo: 'PAS-DEL-CER', nombre: 'Pastillas', categoria: 'Frenos', cantidad: '2' }] });
  });

  it('aCuerpo: sin causa no hay dictamen, y el repuesto va solo con código y cantidad', () => {
    const cuerpo = aCuerpo(' ok ', [
      {
        clave: 'a',
        id: 4,
        sku: 'FRE-PAST-DEL',
        descripcion: ' cambio ',
        causa: '',
        aplica: true,
        motivo: ' ',
        repuestos: [{ clave: 'r', codigo: 'PAS-DEL-CER', nombre: 'Pastillas', categoria: 'Frenos', cantidad: '3' }],
        evidencias: [],
      },
    ]);
    expect(cuerpo.tareas[0]).toEqual({
      id: 4,
      sku: 'FRE-PAST-DEL',
      descripcion: 'cambio',
      causa: null,
      garantiaAplica: false,
      garantiaMotivo: '',
      repuestos: [{ codigoRepuesto: 'PAS-DEL-CER', cantidad: 3 }],
    });
  });
});

describe('página del diagnóstico', () => {
  const asignado = orden({ estado: 'en_diagnostico', asignaciones: [{ id: 1, etapa: 'diagnostico', mecanico_id: 'id-mecanico', mecanico: 'Ana Prueba' }] });
  const abrir = (d: object, o: object = asignado, actor = actorDe('mecanico')) =>
    renderizar(<DiagnosticoPagina />, {
      actor,
      ruta: '/ordenes/OT-0001/diagnostico',
      patron: '/ordenes/:codigo/diagnostico',
      rutas: {
        '/api/ordenes/OT-0001/diagnostico': d,
        '/api/ordenes/OT-0001': o,
        '/api/servicios': catalogo,
        '/api/ordenes/OT-0001/repuestos-tienda': busqueda(),
        '/api/talleres': [sede(), sedeFrenos()],
      },
    });

  it('el mecánico asignado edita el borrador y, en mantenimiento, puede remitir', async () => {
    abrir(diagnostico());
    expect(await screen.findByRole('button', { name: 'Guardar borrador' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remitir a sede especializada' })).toBeInTheDocument();
  });

  it('en una sede especializada no se ofrece remitir', async () => {
    abrir(diagnostico(), { ...asignado, sede: sedeFrenos() }, actorDe('mecanico', 'id-mecanico', 2));
    await screen.findByRole('button', { name: 'Guardar borrador' });
    expect(screen.queryByRole('button', { name: 'Remitir a sede especializada' })).not.toBeInTheDocument();
  });

  it('finalizado muestra la respuesta del concesionario y quién paga', async () => {
    abrir(
      diagnostico({
        estado: 'finalizado',
        estado_orden: 'en_cotizacion',
        servicios: [
          servicioDiagnostico({
            causa: 'manipulacion_cliente',
            causa_nombre: 'Manipulación del cliente',
            garantia: { aplica: false, motivo: 'Cables empalmados', valida: false, respuesta: 'Manipulación del cliente', pagador: 'cliente' },
            evidencias: [{ id: 7, nombre: 'cables.jpg', tipo: 'jpg', url: '/api/evidencias/7' }],
          }),
        ],
        total_mano_obra: 90000,
      }),
    );
    const tarjeta = (await screen.findByText('Garantía no válida')).closest('div')!;
    expect(within(tarjeta.parentElement!).getByText(/Cables empalmados/)).toBeInTheDocument();
    expect(screen.getByText('Paga: Cliente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cables\.jpg/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
  });

  it('un mecánico no asignado a diagnóstico no puede editar', async () => {
    abrir(diagnostico(), orden({ estado: 'en_diagnostico', asignaciones: [{ id: 1, etapa: 'diagnostico', mecanico_id: 'otro', mecanico: 'Luis' }] }));
    expect(await screen.findByText('Diagnóstico')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
  });
});
