import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actorDe, conParams, peticion } from '@/comun/pruebas';
import * as usuarios from '@/usuarios/usuarios.service';
import * as rutaId from './[id]/route';
import * as rutaRoles from './route';

vi.mock('@/usuarios/usuarios.service', () => ({
  actorDelToken: vi.fn(),
  listarRoles: vi.fn(async () => []),
  editarRol: vi.fn(async (id: number, descripcion: string) => ({ id, descripcion })),
}));

const comoRol = (rol: string) => vi.mocked(usuarios.actorDelToken).mockResolvedValue(actorDe(rol));

describe('/api/roles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('los roles no se crean ni se borran: no existen POST ni DELETE', () => {
    expect(Object.keys(rutaRoles)).not.toContain('POST');
    expect(Object.keys(rutaId)).not.toContain('DELETE');
  });

  it('solo el administrador los lista', async () => {
    comoRol('recepcionista');
    expect((await rutaRoles.GET(peticion('/api/roles'), conParams({}))).status).toBe(403);
    comoRol('administrador');
    expect((await rutaRoles.GET(peticion('/api/roles'), conParams({}))).status).toBe(200);
  });

  it('el administrador edita solo la descripción', async () => {
    comoRol('administrador');
    const r = await rutaId.PATCH(
      peticion('/api/roles/2', { metodo: 'PATCH', cuerpo: { descripcion: 'Atiende clientes', nombre: 'jefe' } }),
      conParams({ id: '2' }),
    );
    expect(r.status).toBe(200);
    expect(usuarios.editarRol).toHaveBeenCalledWith(2, 'Atiende clientes');
  });
});
