import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt) as (
  clave: string,
  sal: Buffer,
  largo: number,
) => Promise<Buffer>;

// Guarda "scrypt$sal$huella". La sal es distinta para cada usuario.
export async function cifrarClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const huella = await derivar(clave, sal, 64);
  return `scrypt$${sal.toString('base64')}$${huella.toString('base64')}`;
}

export async function claveCorrecta(
  clave: string,
  guardada: string,
): Promise<boolean> {
  const [algoritmo, sal, huella] = guardada.split('$');
  if (algoritmo !== 'scrypt' || !sal || !huella) return false;
  const esperada = Buffer.from(huella, 'base64');
  const calculada = await derivar(clave, Buffer.from(sal, 'base64'), esperada.length);
  // Compara en tiempo constante: el tiempo de respuesta no revela cuántos caracteres
  // coinciden.
  return timingSafeEqual(calculada, esperada);
}
