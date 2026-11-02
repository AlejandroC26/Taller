import { randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { requerida } from '../config';
import { noAutorizado } from '../comun/errores';

// Dos tipos de token: 'web' para la página y la API (8 horas) y 'mcp' para los
// asistentes y otros sistemas (7 días). El MCP acepta además el token fijo del usuario
// agente-compartido (usuarios.service, actorDelToken).
export type Audiencia = 'web' | 'mcp';
const DURACION: Record<Audiencia, string> = { web: '8h', mcp: '7d' };
const EMISOR = 'taller';

const secreto = () => new TextEncoder().encode(requerida('TALLER_JWT_SECRETO'));

export function emitir(sub: string, audiencia: Audiencia): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(EMISOR)
    .setAudience(audiencia)
    .setIssuedAt()
    .setExpirationTime(DURACION[audiencia])
    .sign(secreto());
}

// Devuelve el id del usuario. Un token de otra audiencia no sirve: el de la web no
// abre el MCP y al revés.
export async function verificar(
  token: string | undefined,
  audiencia: Audiencia,
): Promise<string> {
  if (!token) throw noAutorizado('Falta el token de acceso');
  try {
    const { payload } = await jwtVerify(token, secreto(), {
      issuer: EMISOR,
      audience: audiencia,
    });
    if (!payload.sub) throw new Error('sin sub');
    return payload.sub;
  } catch {
    throw noAutorizado('El token no es válido o ya venció');
  }
}

// Un JWT tiene tres partes separadas por puntos. Lo demás se busca como token fijo.
export const pareceJwt = (token: string) => token.split('.').length === 3;

// Token fijo legible para el ejercicio: pl-mcp- y 24 caracteres al azar.
export const nuevoTokenFijo = () => `pl-mcp-${randomBytes(12).toString('hex')}`;

export function tokenDe(req: Request): string | undefined {
  const [tipo, token] = (req.headers.get('authorization') ?? '').split(' ');
  return tipo === 'Bearer' && token ? token : undefined;
}
