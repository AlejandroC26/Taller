import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conflicto } from '../comun/errores';
import { actorDe } from '../comun/pruebas';
import * as inventario from '../inventario/inventario.service';
import * as ordenes from '../ordenes/ordenes.service';
import { crearServidorMcp, herramientasDe } from './herramientas';

vi.mock('../inventario/inventario.service', () => ({
  listarItems: vi.fn(async () => [{ id: 1, nombre: 'Filtro', enAlerta: true }]),
  registrarMovimiento: vi.fn(),
}));
vi.mock('../ordenes/ordenes.service', () => ({
  cancelar: vi.fn(),
  crearOrden: vi.fn(async () => ({ codigo: 'OT-0001' })),
  listarOrdenes: vi.fn(async () => []),
  unaOrden: vi.fn(),
  asignar: vi.fn(),
  cambiarEstado: vi.fn(),
  disponibilidad: vi.fn(),
  panel: vi.fn(),
}));

// Conecta un cliente MCP real al servidor del taller, en memoria.
async function conectar(rol: string) {
  const [lado1, lado2] = InMemoryTransport.createLinkedPair();
  const servidor = crearServidorMcp(actorDe(rol));
  await servidor.connect(lado1);
  const cliente = new Client({ name: 'prueba', version: '1.0.0' });
  await cliente.connect(lado2);
  return cliente;
}

describe('herramientas por rol', () => {
  it('el mecánico consulta y registra trabajo, pero no cancela ni crea órdenes', () => {
    const lista = herramientasDe('mecanico');
    expect(lista).toContain('consultar_ordenes');
    expect(lista).toContain('registrar_diagnostico');
    expect(lista).toContain('registrar_horas');
    expect(lista).not.toContain('cancelar_orden');
    expect(lista).not.toContain('crear_orden');
    expect(lista).not.toContain('actualizar_inventario');
  });

  it('la recepcionista asigna, cancela y actualiza inventario, pero no registra diagnóstico', () => {
    const lista = herramientasDe('recepcionista');
    expect(lista).toEqual(expect.arrayContaining(['asignar_mecanico', 'cancelar_orden', 'actualizar_inventario', 'consultar_disponibilidad']));
    expect(lista).not.toContain('registrar_diagnostico');
  });

  it('el administrador tiene todas', () => {
    const todas = new Set([...herramientasDe('mecanico'), ...herramientasDe('recepcionista'), ...herramientasDe('concesionario')]);
    expect(new Set(herramientasDe('administrador'))).toEqual(todas);
  });

  it('el concesionario solo envía carros y consulta su estado', () => {
    expect(herramientasDe('concesionario')).toEqual(['registrar_ingreso_vehiculo', 'estado_vehiculo']);
  });

  it('un rol desconocido no tiene herramientas', () => {
    expect(herramientasDe('visitante')).toEqual([]);
  });
});

describe('servidor MCP', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista exactamente las herramientas del rol, con sus anotaciones', async () => {
    const cliente = await conectar('mecanico');
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...herramientasDe('mecanico')].sort());
    expect(tools.find((t) => t.name === 'consultar_inventario')?.annotations?.readOnlyHint).toBe(true);
    await cliente.close();
  });

  it('cancelar_orden está marcada como destructiva', async () => {
    const cliente = await conectar('recepcionista');
    const { tools } = await cliente.listTools();
    expect(tools.find((t) => t.name === 'cancelar_orden')?.annotations?.destructiveHint).toBe(true);
    await cliente.close();
  });

  it('consultar_inventario llama al service con los filtros', async () => {
    const cliente = await conectar('mecanico');
    const r = await cliente.callTool({ name: 'consultar_inventario', arguments: { solo_alertas: true } });
    expect(r.isError).toBeFalsy();
    expect(inventario.listarItems).toHaveBeenCalledWith({ texto: undefined, soloAlertas: true });
    expect((r.content as { text: string }[])[0].text).toContain('Filtro');
    await cliente.close();
  });

  it('un error de negocio vuelve como resultado con isError, para que el modelo corrija', async () => {
    vi.mocked(ordenes.cancelar).mockRejectedValueOnce(conflicto('La orden OT-0001 está terminado: no puede pasar a cancelado'));
    const cliente = await conectar('recepcionista');
    const r = await cliente.callTool({ name: 'cancelar_orden', arguments: { codigo: 'OT-0001', motivo: 'El cliente desistió' } });
    expect(r.isError).toBe(true);
    expect((r.content as { text: string }[])[0].text).toContain('no puede pasar a cancelado');
    await cliente.close();
  });

  it('crear_orden normaliza la placa con el mismo DTO de la API', async () => {
    const cliente = await conectar('recepcionista');
    await cliente.callTool({ name: 'crear_orden', arguments: { placa: 'abc-123', motivo: 'Cambio de aceite' } });
    expect(ordenes.crearOrden).toHaveBeenCalledWith(expect.anything(), { placa: 'ABC123', motivo: 'Cambio de aceite' });
    await cliente.close();
  });

  it('datos inválidos llegan como error legible, sin llamar al service', async () => {
    const cliente = await conectar('recepcionista');
    const r = await cliente.callTool({ name: 'crear_orden', arguments: { placa: '$$', motivo: 'Ruido' } });
    expect(r.isError).toBe(true);
    expect(ordenes.crearOrden).not.toHaveBeenCalled();
    await cliente.close();
  });
});
