import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { pesos } from './columnas';
import { conflicto, ErrorHttp } from './errores';
import { leerCuerpo, respuestaError, validar } from './http';
import { limitar } from './limite';

describe('validar', () => {
  const esquema = z.object({ nombre: z.string().min(1, 'obligatorio'), edad: z.number() });

  it('devuelve los datos válidos', () => {
    expect(validar(esquema, { nombre: 'a', edad: 1 })).toEqual({ nombre: 'a', edad: 1 });
  });

  it('junta los problemas con su campo en un error 400', () => {
    try {
      validar(esquema, { nombre: '' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorHttp);
      expect((e as ErrorHttp).estado).toBe(400);
      expect((e as Error).message).toContain('nombre: obligatorio');
      expect((e as Error).message).toContain('edad');
    }
  });

  it('un cuerpo que no es JSON responde 400', async () => {
    const req = new Request('http://x', { method: 'POST', body: '{no-json' });
    await expect(leerCuerpo(req, esquema)).rejects.toMatchObject({ estado: 400 });
  });
});

describe('respuestaError', () => {
  it('un error de negocio sale con su código y mensaje', async () => {
    const r = respuestaError(conflicto('ya existe'));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ message: 'ya existe' });
  });

  it('un error inesperado sale como 500 sin detalles internos', async () => {
    const original = console.error;
    console.error = () => {};
    const r = respuestaError(new Error('password de la base'));
    console.error = original;
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain('password');
  });
});

describe('limitar', () => {
  it('permite N intentos por ventana y luego responde 429', () => {
    const llave = `prueba-${Math.random()}`;
    for (let i = 0; i < 3; i++) limitar(llave, 3, 60_000, 1000);
    expect(() => limitar(llave, 3, 60_000, 1000)).toThrow(ErrorHttp);
    // pasada la ventana se vuelve a permitir
    expect(() => limitar(llave, 3, 60_000, 62_000)).not.toThrow();
  });
});

describe('pesos', () => {
  it('redondea a dos decimales', () => {
    expect(pesos(0.1 + 0.2)).toBe(0.3);
    expect(pesos(1234.567)).toBe(1234.57);
  });
});
