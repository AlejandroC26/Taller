import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { editarRolDto } from '@/usuarios/dto';
import { SOLO_ADMIN } from '@/usuarios/rol.entity';
import { borrarRol, editarRol } from '@/usuarios/usuarios.service';

export const runtime = 'nodejs';

export const PATCH = ruta<{ id: string }>(SOLO_ADMIN, async ({ req, params }) =>
  editarRol(Number(params.id), (await leerCuerpo(req, editarRolDto)).descripcion),
);

export const DELETE = ruta<{ id: string }>(SOLO_ADMIN, async ({ params }) =>
  borrarRol(Number(params.id)),
);
