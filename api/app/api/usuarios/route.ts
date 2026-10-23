import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { nuevoUsuarioDto } from '@/usuarios/dto';
import { SOLO_ADMIN } from '@/usuarios/rol.entity';
import { crearUsuario, listarUsuarios } from '@/usuarios/usuarios.service';

export const runtime = 'nodejs';

export const GET = ruta(SOLO_ADMIN, async ({ url }) =>
  listarUsuarios(url.searchParams.get('rol') ?? undefined),
);

export const POST = ruta(
  SOLO_ADMIN,
  async ({ req }) => crearUsuario(await leerCuerpo(req, nuevoUsuarioDto)),
  201,
);
