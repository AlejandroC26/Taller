import { describe, expect, it } from 'vitest';
import { cifrarClave, claveCorrecta } from './claves';

describe('claves', () => {
  it('guarda la huella con el formato scrypt$sal$huella y nunca la clave', async () => {
    const huella = await cifrarClave('clave-segura-123');
    expect(huella).toMatch(/^scrypt\$[^$]+\$[^$]+$/);
    expect(huella).not.toContain('clave-segura-123');
  });

  it('usa una sal distinta cada vez', async () => {
    expect(await cifrarClave('misma-clave-1')).not.toBe(await cifrarClave('misma-clave-1'));
  });

  it('acepta la clave correcta y rechaza una errada', async () => {
    const huella = await cifrarClave('clave-segura-123');
    expect(await claveCorrecta('clave-segura-123', huella)).toBe(true);
    expect(await claveCorrecta('otra-clave-123', huella)).toBe(false);
  });

  it('rechaza huellas con otro formato', async () => {
    expect(await claveCorrecta('x', 'md5$abc$def')).toBe(false);
    expect(await claveCorrecta('x', 'basura')).toBe(false);
  });
});
