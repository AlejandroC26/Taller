import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { rolDto } from '@/usuarios/dto';
import { SOLO_ADMIN } from '@/usuarios/rol.entity';
import { crearRol, listarRoles } from '@/usuarios/usuarios.service';

export const runtime = 'nodejs';

export const GET = ruta(SOLO_ADMIN, async () => listarRoles());

export const POST = ruta(
  SOLO_ADMIN,
  async ({ req }) => crearRol(await leerCuerpo(req, rolDto)),
  201,
);
