import { describe, expect, it, vi } from 'vitest';
import { noAutorizado } from '@/comun/errores';
import { peticion } from '@/comun/pruebas';
import * as usuarios from '@/usuarios/usuarios.service';
import { POST } from './route';

vi.mock('@/usuarios/usuarios.service', () => ({ actorDelToken: vi.fn() }));

describe('/mcp', () => {
  it('sin token válido de tipo mcp responde 401 con WWW-Authenticate', async () => {
    vi.mocked(usuarios.actorDelToken).mockRejectedValue(noAutorizado('El token no es válido o ya venció'));
    const r = await POST(peticion('/mcp', { metodo: 'POST', cuerpo: {} }));
    expect(r.status).toBe(401);
    expect(r.headers.get('WWW-Authenticate')).toBe('Bearer');
    expect(usuarios.actorDelToken).toHaveBeenCalledWith('token', 'mcp');
  });

  it('si falla la base de datos responde 503, no 401: el token no es el problema', async () => {
    vi.mocked(usuarios.actorDelToken).mockRejectedValue(new AggregateError([], ''));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await POST(peticion('/mcp', { metodo: 'POST', cuerpo: {} }));
    expect(r.status).toBe(503);
    expect(r.headers.get('WWW-Authenticate')).toBeNull();
    expect((await r.json()).error).toMatch(/base de datos/);
  });
});
