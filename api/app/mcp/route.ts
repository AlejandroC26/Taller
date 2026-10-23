import { createMcpHandler } from '@modelcontextprotocol/server';
import { crearServidorMcp } from '@/mcp/herramientas';
import type { Actor } from '@/usuarios/actor';
import { tokenDe } from '@/usuarios/tokens';
import { actorDelToken } from '@/usuarios/usuarios.service';

export const runtime = 'nodejs';

// Por cada petición se crea un servidor para el usuario dueño del token.
const manejador = createMcpHandler(({ authInfo }) => crearServidorMcp(authInfo?.extra?.actor as Actor));

// Esta puerta exige su propio token, el de tipo 'mcp' (POST /api/auth/token-mcp). El de
// la web no sirve aquí.
async function atender(req: Request): Promise<Response> {
  const token = tokenDe(req);
  let actor: Actor;
  try {
    actor = await actorDelToken(token, 'mcp');
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    );
  }
  return manejador.fetch(req, {
    authInfo: { token: token as string, clientId: actor.id, scopes: [actor.rol], extra: { actor } },
  });
}

export { atender as DELETE, atender as GET, atender as POST };
