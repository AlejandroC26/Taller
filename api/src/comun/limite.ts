import { ErrorHttp } from './errores';

// Límite simple en memoria: N intentos por minuto por llave (por ejemplo, la IP en el
// inicio de sesión). Suficiente para un solo proceso.
const intentos = new Map<string, number[]>();

export function limitar(llave: string, maximo = 10, ventanaMs = 60_000, ahora = Date.now()) {
  const recientes = (intentos.get(llave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (recientes.length >= maximo) {
    throw new ErrorHttp(429, 'Demasiados intentos. Espere un minuto e intente de nuevo');
  }
  recientes.push(ahora);
  intentos.set(llave, recientes);
}

export const ipDe = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
