import type { Actor } from '../usuarios/actor';
import { tokenDe } from '../usuarios/tokens';
import { actorDelToken } from '../usuarios/usuarios.service';
import { prohibido } from './errores';
import { respuestaError } from './http';

export interface Contexto<P> {
  req: Request;
  url: URL;
  actor: Actor;
  params: P;
}

type Manejador<P> = (ctx: Contexto<P>) => Promise<unknown>;

// Envuelve un route handler de Next: valida el token web, revisa el rol y convierte
// los errores de negocio en respuestas. Las reglas finas (por ejemplo, que un mecánico
// solo vea sus órdenes) están en los services.
//   export const GET = ruta(PERSONAL, async ({ actor }) => listar(actor));
export function ruta<P = Record<string, string>>(
  permitidos: readonly string[] | 'todos',
  manejador: Manejador<P>,
  estadoExito = 200,
) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const actor = await actorDelToken(tokenDe(req), 'web');
      if (permitidos !== 'todos' && !permitidos.includes(actor.rol)) {
        throw prohibido('Su rol no permite esta acción');
      }
      const params = (await ctx?.params) ?? ({} as P);
      const datos = await manejador({ req, url: new URL(req.url), actor, params });
      return datos instanceof Response
        ? datos
        : Response.json(datos ?? null, { status: estadoExito });
    } catch (error) {
      return respuestaError(error);
    }
  };
}

// Ruta sin token.
export function publica(manejador: (req: Request) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    try {
      const datos = await manejador(req);
      return datos instanceof Response ? datos : Response.json(datos ?? null);
    } catch (error) {
      return respuestaError(error);
    }
  };
}
