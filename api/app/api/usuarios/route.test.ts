import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noAutorizado } from '@/comun/errores';
import { actorDe, conParams, leer, peticion } from '@/comun/pruebas';
import * as servicio from '@/usuarios/usuarios.service';
import { PATCH } from './[id]/route';
import { GET, POST } from './route';

vi.mock('@/usuarios/usuarios.service', () => ({
  actorDelToken: vi.fn(),
  listarUsuarios: vi.fn(async () => []),
  crearUsuario: vi.fn(async (d: { usuario: string }) => ({ id: 'nuevo', usuario: d.usuario })),
  editarUsuario: vi.fn(async (id: string) => ({ id })),
}));

const comoRol = (rol: string) => vi.mocked(servicio.actorDelToken).mockResolvedValue(actorDe(rol));

const nuevo = {
  nombre: 'Luis',
  apellido: 'Gómez',
  documento: '80123456',
  telefono: '3105556677',
  usuario: 'lgomez',
  clave: 'clave-larga-1',
  rol: 'mecanico',
};

describe('/api/usuarios', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin token responde 401', async () => {
    vi.mocked(servicio.actorDelToken).mockRejectedValue(noAutorizado('Falta el token de acceso'));
    const r = await leer(await GET(peticion('/api/usuarios', { token: null }), conParams({})));
    expect(r.estado).toBe(401);
  });

  it.each(['recepcionista', 'mecanico'])('el rol %s recibe 403', async (rol) => {
    comoRol(rol);
    expect((await GET(peticion('/api/usuarios'), conParams({}))).status).toBe(403);
    expect(servicio.listarUsuarios).not.toHaveBeenCalled();
  });

  it('el administrador lista y puede filtrar por rol', async () => {
    comoRol('administrador');
    const r = await GET(peticion('/api/usuarios?rol=mecanico'), conParams({}));
    expect(r.status).toBe(200);
    expect(servicio.listarUsuarios).toHaveBeenCalledWith('mecanico');
  });

  it('crear un usuario responde 201', async () => {
    comoRol('administrador');
    const r = await leer(await POST(peticion('/api/usuarios', { metodo: 'POST', cuerpo: nuevo }), conParams({})));
    expect(r.estado).toBe(201);
    expect(r.json.usuario).toBe('lgomez');
  });

  it('crear con datos inválidos responde 400 y no llama al service', async () => {
    comoRol('administrador');
    const r = await POST(peticion('/api/usuarios', { metodo: 'POST', cuerpo: { ...nuevo, clave: 'x' } }), conParams({}));
    expect(r.status).toBe(400);
    expect(servicio.crearUsuario).not.toHaveBeenCalled();
  });

  it('editar pasa el id y el actor al service', async () => {
    comoRol('administrador');
    await PATCH(peticion('/api/usuarios/abc', { metodo: 'PATCH', cuerpo: { activo: false } }), conParams({ id: 'abc' }));
    expect(servicio.editarUsuario).toHaveBeenCalledWith(
      'abc',
      { activo: false },
      expect.objectContaining({ rol: 'administrador' }),
    );
  });
});
