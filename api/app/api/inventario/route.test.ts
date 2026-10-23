import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actorDe, conParams, peticion } from '@/comun/pruebas';
import * as inventario from '@/inventario/inventario.service';
import * as usuarios from '@/usuarios/usuarios.service';
import { POST as mover } from './[id]/movimientos/route';
import { PATCH } from './[id]/route';
import { GET as alertas } from './alertas/route';
import { GET, POST } from './route';

vi.mock('@/usuarios/usuarios.service', () => ({ actorDelToken: vi.fn() }));
vi.mock('@/inventario/inventario.service', () => ({
  listarItems: vi.fn(async () => []),
  crearItem: vi.fn(async () => ({ id: 1 })),
  editarItem: vi.fn(async () => ({ id: 1 })),
  registrarMovimiento: vi.fn(async () => ({ id: 1, cantidad: 9 })),
}));

const comoRol = (rol: string) => vi.mocked(usuarios.actorDelToken).mockResolvedValue(actorDe(rol));
const item = { codigo: 'FIL-02', nombre: 'Filtro', precio: 1000, categoriaId: 1 };

describe('/api/inventario', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el mecánico puede consultar con filtros', async () => {
    comoRol('mecanico');
    const r = await GET(peticion('/api/inventario?buscar=filtro&alertas=1&categoria=2'), conParams({}));
    expect(r.status).toBe(200);
    expect(inventario.listarItems).toHaveBeenCalledWith({ texto: 'filtro', soloAlertas: true, categoriaId: 2 });
  });

  it('las alertas solo traen ítems en alerta', async () => {
    comoRol('mecanico');
    await alertas(peticion('/api/inventario/alertas'), conParams({}));
    expect(inventario.listarItems).toHaveBeenCalledWith({ soloAlertas: true });
  });

  it('el mecánico no puede crear, editar ni mover existencias (403)', async () => {
    comoRol('mecanico');
    expect((await POST(peticion('/api/inventario', { metodo: 'POST', cuerpo: item }), conParams({}))).status).toBe(403);
    expect((await PATCH(peticion('/api/inventario/1', { metodo: 'PATCH', cuerpo: {} }), conParams({ id: '1' }))).status).toBe(403);
    expect(
      (await mover(peticion('/api/inventario/1/movimientos', { metodo: 'POST', cuerpo: { tipo: 'entrada', cantidad: 1 } }), conParams({ id: '1' }))).status,
    ).toBe(403);
    expect(inventario.crearItem).not.toHaveBeenCalled();
  });

  it('la recepcionista crea ítems (201) y registra entradas', async () => {
    comoRol('recepcionista');
    expect((await POST(peticion('/api/inventario', { metodo: 'POST', cuerpo: item }), conParams({}))).status).toBe(201);
    const r = await mover(
      peticion('/api/inventario/4/movimientos', { metodo: 'POST', cuerpo: { tipo: 'entrada', cantidad: 5, nota: 'Factura 12' } }),
      conParams({ id: '4' }),
    );
    expect(r.status).toBe(201);
    expect(inventario.registrarMovimiento).toHaveBeenCalledWith(
      4,
      { tipo: 'entrada', cantidad: 5, nota: 'Factura 12' },
      expect.objectContaining({ rol: 'recepcionista' }),
    );
  });

  it('un id que no es número responde 400', async () => {
    comoRol('administrador');
    const r = await PATCH(peticion('/api/inventario/abc', { metodo: 'PATCH', cuerpo: {} }), conParams({ id: 'abc' }));
    expect(r.status).toBe(400);
  });
});
