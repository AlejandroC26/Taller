import { describe, expect, it, vi } from 'vitest';
import { simularApi } from '../pruebas/utilidades';
import { api, ErrorApi, guardarToken, leerToken, SESION_VENCIDA } from './cliente';

describe('cliente de la API', () => {
  it('envía el token Bearer y el cuerpo en JSON', async () => {
    guardarToken('abc');
    const llamadas = simularApi({ 'POST /api/ordenes': { codigo: 'OT-0001' } });
    const r = await api<{ codigo: string }>('/api/ordenes', { metodo: 'POST', cuerpo: { placa: 'ABC123' } });
    expect(r.codigo).toBe('OT-0001');
    expect(llamadas[0].cuerpo).toEqual({ placa: 'ABC123' });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
  });

  it('convierte el error de la API en ErrorApi con su mensaje', async () => {
    simularApi({ '/api/ordenes': { estado: 409, json: { message: 'Ya tiene una orden abierta' } } });
    await expect(api('/api/ordenes')).rejects.toMatchObject({ estado: 409, message: 'Ya tiene una orden abierta' });
  });

  it('un 401 con sesión borra el token y avisa que la sesión venció', async () => {
    guardarToken('vencido');
    simularApi({ '/api/panel': { estado: 401, json: { message: 'El token no es válido o ya venció' } } });
    const escucha = vi.fn();
    window.addEventListener(SESION_VENCIDA, escucha);
    await expect(api('/api/panel')).rejects.toBeInstanceOf(ErrorApi);
    expect(leerToken()).toBeNull();
    expect(escucha).toHaveBeenCalledOnce();
    window.removeEventListener(SESION_VENCIDA, escucha);
  });

  it('sin conexión responde un error claro', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/api/panel')).rejects.toMatchObject({ estado: 0, message: 'No hay conexión con la API del taller' });
  });
});
