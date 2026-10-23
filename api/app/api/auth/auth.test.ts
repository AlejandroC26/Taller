import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noAutorizado } from '@/comun/errores';
import { actorDe, conParams, leer, peticion } from '@/comun/pruebas';
import * as servicio from '@/usuarios/usuarios.service';
import { POST as entrar } from './entrar/route';
import { POST as tokenMcp } from './token-mcp/route';
import { GET as yo } from './yo/route';

vi.mock('@/usuarios/usuarios.service', () => ({
  actorDelToken: vi.fn(),
  entrar: vi.fn(),
  tokenMcp: vi.fn(async () => 'token-mcp'),
}));

describe('/api/auth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('entrar devuelve el token y el usuario', async () => {
    vi.mocked(servicio.entrar).mockResolvedValue({ token: 't', usuario: actorDe('mecanico') });
    const r = await leer(
      await entrar(peticion('/api/auth/entrar', { metodo: 'POST', token: null, cuerpo: { usuario: 'Mecanico', clave: 'x' } })),
    );
    expect(r.estado).toBe(200);
    expect(r.json.token).toBe('t');
    expect(servicio.entrar).toHaveBeenCalledWith('mecanico', 'x');
  });

  it('credenciales erradas responden 401', async () => {
    vi.mocked(servicio.entrar).mockRejectedValue(noAutorizado('Usuario o clave incorrectos'));
    const r = await leer(
      await entrar(
        new Request('http://localhost/api/auth/entrar', {
          method: 'POST',
          headers: { 'x-forwarded-for': '10.0.0.1' },
          body: JSON.stringify({ usuario: 'a', clave: 'b' }),
        }),
      ),
    );
    expect(r.estado).toBe(401);
    expect(r.json.message).toBe('Usuario o clave incorrectos');
  });

  it('frena con 429 después de 10 intentos por minuto desde la misma IP', async () => {
    vi.mocked(servicio.entrar).mockRejectedValue(noAutorizado('x'));
    const intento = () =>
      entrar(
        new Request('http://localhost/api/auth/entrar', {
          method: 'POST',
          headers: { 'x-forwarded-for': '10.9.9.9' },
          body: JSON.stringify({ usuario: 'a', clave: 'b' }),
        }),
      );
    for (let i = 0; i < 10; i++) await intento();
    expect((await intento()).status).toBe(429);
  });

  it('yo devuelve al actor del token', async () => {
    vi.mocked(servicio.actorDelToken).mockResolvedValue(actorDe('recepcionista'));
    const r = await leer(await yo(peticion('/api/auth/yo'), conParams({})));
    expect(r.json.rol).toBe('recepcionista');
  });

  it('token-mcp entrega un token para el MCP', async () => {
    vi.mocked(servicio.actorDelToken).mockResolvedValue(actorDe('mecanico'));
    const r = await leer(await tokenMcp(peticion('/api/auth/token-mcp', { metodo: 'POST' }), conParams({})));
    expect(r.json).toEqual({ token: 'token-mcp' });
  });
});
