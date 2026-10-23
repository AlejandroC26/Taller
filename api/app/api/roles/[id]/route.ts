import { ruta } from '@/comun/guardia';
import { entero, leerCuerpo } from '@/comun/http';
import { editarRolDto } from '@/usuarios/dto';
import { SOLO_ADMIN } from '@/usuarios/rol.entity';
import { editarRol } from '@/usuarios/usuarios.service';

export const runtime = 'nodejs';

export const PATCH = ruta<{ id: string }>(SOLO_ADMIN, async ({ req, params }) =>
  editarRol(entero(params.id), (await leerCuerpo(req, editarRolDto)).descripcion),
);
