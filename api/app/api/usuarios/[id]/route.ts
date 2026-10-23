import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { editarUsuarioDto } from '@/usuarios/dto';
import { SOLO_ADMIN } from '@/usuarios/rol.entity';
import { editarUsuario } from '@/usuarios/usuarios.service';

export const runtime = 'nodejs';

export const PATCH = ruta<{ id: string }>(SOLO_ADMIN, async ({ req, params, actor }) =>
  editarUsuario(params.id, await leerCuerpo(req, editarUsuarioDto), actor),
);
