// Ayudas para las pruebas unitarias de rutas (no se usan en producción).
import type { Actor } from '../usuarios/actor';

export const actorDe = (rol: string, id = `id-${rol}`): Actor => ({
  id,
  nombre: rol,
  apellido: 'Prueba',
  usuario: rol,
  rol,
});

export function peticion(
  ruta: string,
  { metodo = 'GET', cuerpo, token = 'token' }: { metodo?: string; cuerpo?: unknown; token?: string | null } = {},
) {
  return new Request(`http://localhost${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

// Contexto de Next con params.
export const conParams = <P>(params: P) => ({ params: Promise.resolve(params) });

export async function leer(respuesta: Response) {
  return { estado: respuesta.status, json: await respuesta.json() };
}
