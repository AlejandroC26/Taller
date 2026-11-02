import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actorDe, conParams, leer, peticion } from '@/comun/pruebas';
import * as diagnosticos from '@/diagnosticos/diagnosticos.service';
import * as evidencias from '@/diagnosticos/evidencias.service';
import * as ordenes from '@/ordenes/ordenes.service';
import * as usuarios from '@/usuarios/usuarios.service';
import { GET as verEvidencia } from '../evidencias/[id]/route';
import { POST as subirEvidencia } from './[codigo]/evidencias/route';
import { POST as remitir } from './[codigo]/remitir/route';
import { GET as repuestosTienda } from './[codigo]/repuestos-tienda/route';
import { POST as tomar } from './[codigo]/tomar/route';
import { GET } from './route';

vi.mock('@/usuarios/usuarios.service', () => ({ actorDelToken: vi.fn() }));
vi.mock('@/ordenes/ordenes.service', async (original) => ({
  ...(await original<typeof import('@/ordenes/ordenes.service')>()),
  listarOrdenes: vi.fn(async () => []),
  tomarOrden: vi.fn(async () => ({ codigo: 'OT-0001', estado: 'en_diagnostico' })),
}));
vi.mock('@/diagnosticos/diagnosticos.service', () => ({
  remitirOrden: vi.fn(async () => ({ estado: 'remitida' })),
  buscarRepuestosParaOrden: vi.fn(async () => ({ repuestos: [], sin_respuesta: [] })),
}));
vi.mock('@/diagnosticos/evidencias.service', () => ({
  guardarEvidencia: vi.fn(async () => ({ id: 1 })),
  listarEvidencias: vi.fn(async () => []),
  leerEvidencia: vi.fn(async () => ({ nombre: 'freno.jpg', tipo: 'image/jpeg', datos: Buffer.from([0xff, 0xd8, 0xff]) })),
}));

const comoRol = (rol: string) => vi.mocked(usuarios.actorDelToken).mockResolvedValue(actorDe(rol));
const p = (codigo = 'OT-0001') => conParams({ codigo });

describe('rutas del mecánico', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista sus órdenes o la cola de su sede', async () => {
    comoRol('mecanico');
    await GET(peticion('/api/ordenes?vista=cola'), conParams({}));
    expect(ordenes.listarOrdenes).toHaveBeenCalledWith(expect.objectContaining({ rol: 'mecanico' }), expect.objectContaining({ vista: 'cola' }));
    expect((await GET(peticion('/api/ordenes?vista=otra'), conParams({}))).status).toBe(400);
  });

  it('tomar sin cuerpo toma para sí mismo', async () => {
    comoRol('mecanico');
    const r = await leer(await tomar(peticion('/x', { metodo: 'POST' }), p()));
    expect(r.estado).toBe(200);
    expect(ordenes.tomarOrden).toHaveBeenCalledWith(expect.anything(), 'OT-0001', undefined);
  });

  it('remitir exige sede y nota', async () => {
    comoRol('mecanico');
    expect((await remitir(peticion('/x', { metodo: 'POST', cuerpo: { taller: 'PL-FRENOS' } }), p())).status).toBe(400);
    await remitir(peticion('/x', { metodo: 'POST', cuerpo: { taller: 'PL-FRENOS', nota: 'Ruido en la rueda delantera' } }), p());
    expect(diagnosticos.remitirOrden).toHaveBeenCalledWith(expect.anything(), 'OT-0001', 'PL-FRENOS', 'Ruido en la rueda delantera');
  });

  it('busca en el catálogo de la tienda por texto y categoría', async () => {
    comoRol('mecanico');
    expect((await repuestosTienda(peticion('/x?texto=pastillas&categoria=Frenos'), p())).status).toBe(200);
    expect(diagnosticos.buscarRepuestosParaOrden).toHaveBeenCalledWith(expect.anything(), 'OT-0001', { texto: 'pastillas', categoria: 'Frenos', refrescar: false });
    await repuestosTienda(peticion('/x?refrescar=true'), p());
    expect(diagnosticos.buscarRepuestosParaOrden).toHaveBeenLastCalledWith(expect.anything(), 'OT-0001', { texto: undefined, categoria: undefined, refrescar: true });
  });

  it('sube la evidencia como multipart y pasa los bytes al service', async () => {
    comoRol('mecanico');
    const formulario = new FormData();
    formulario.append('archivo', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'freno.jpg', { type: 'image/jpeg' }));
    formulario.append('tareaId', '7');
    const r = await subirEvidencia(new Request('http://localhost/x', { method: 'POST', body: formulario, headers: { Authorization: 'Bearer t' } }), p());
    expect(r.status).toBe(201);
    expect(evidencias.guardarEvidencia).toHaveBeenCalledWith(expect.anything(), 'OT-0001', {
      nombre: 'freno.jpg',
      datos: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      tareaId: 7,
    });
  });

  it('sin archivo responde 400', async () => {
    comoRol('mecanico');
    const r = await subirEvidencia(new Request('http://localhost/x', { method: 'POST', body: new FormData(), headers: { Authorization: 'Bearer t' } }), p());
    expect(r.status).toBe(400);
  });

  it('la evidencia se descarga con su tipo', async () => {
    comoRol('agente');
    const r = await verEvidencia(peticion('/api/evidencias/1'), conParams({ id: '1' }));
    expect(r.headers.get('Content-Type')).toBe('image/jpeg');
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
  });
});
