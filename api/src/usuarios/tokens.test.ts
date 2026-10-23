import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHttp } from '../comun/errores';
import { emitir, tokenDe, verificar } from './tokens';

describe('tokens', () => {
  beforeEach(() => {
    vi.stubEnv('TALLER_JWT_SECRETO', 'secreto-de-prueba-largo-y-al-azar');
  });

  it('emite un token web que se verifica y devuelve el id del usuario', async () => {
    const token = await emitir('usuario-1', 'web');
    expect(await verificar(token, 'web')).toBe('usuario-1');
  });

  it('un token web no abre el MCP, ni al revés', async () => {
    const web = await emitir('usuario-1', 'web');
    const mcp = await emitir('usuario-1', 'mcp');
    await expect(verificar(web, 'mcp')).rejects.toMatchObject({ estado: 401 });
    await expect(verificar(mcp, 'web')).rejects.toMatchObject({ estado: 401 });
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const token = await emitir('usuario-1', 'web');
    vi.stubEnv('TALLER_JWT_SECRETO', 'otro-secreto-distinto-al-original');
    await expect(verificar(token, 'web')).rejects.toBeInstanceOf(ErrorHttp);
  });

  it('sin token responde 401 con mensaje claro', async () => {
    await expect(verificar(undefined, 'web')).rejects.toThrow('Falta el token de acceso');
  });

  it('lee el token Bearer de la cabecera', () => {
    const conToken = new Request('http://x', { headers: { Authorization: 'Bearer abc' } });
    const otro = new Request('http://x', { headers: { Authorization: 'Basic abc' } });
    expect(tokenDe(conToken)).toBe('abc');
    expect(tokenDe(otro)).toBeUndefined();
    expect(tokenDe(new Request('http://x'))).toBeUndefined();
  });
});
