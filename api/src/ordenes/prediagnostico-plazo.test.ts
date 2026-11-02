import { describe, expect, it, vi } from 'vitest';
import { consultarPrediagnostico } from './ordenes.service';

// El concesionario nunca debe quedar colgado: si algo no responde, un error claro.
vi.mock('../relaciones/relaciones.service', async (original) => ({
  ...(await original<typeof import('../relaciones/relaciones.service')>()),
  obtenerRelacion: vi.fn(() => new Promise(() => {})),
}));

describe('plazo del prediagnóstico', () => {
  it('si no alcanza a tiempo responde 503 con un mensaje para reintentar', async () => {
    await expect(consultarPrediagnostico({ idRelacion: 'REL-1001', mensajesCliente: ['chilla al frenar'] }, 30)).rejects.toMatchObject({
      estado: 503,
      message: 'No se pudo calcular el prediagnóstico a tiempo, intente de nuevo',
    });
  });
});
