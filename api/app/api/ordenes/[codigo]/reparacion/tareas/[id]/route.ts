import { ruta } from '@/comun/guardia';
import { entero, leerCuerpo } from '@/comun/http';
import { tareaHechaDto } from '@/reparaciones/dto';
import { marcarTarea } from '@/reparaciones/reparaciones.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const PATCH = ruta<{ codigo: string; id: string }>(TALLER, async ({ req, actor, params }) =>
  marcarTarea(actor, params.codigo, entero(params.id), (await leerCuerpo(req, tareaHechaDto)).completada),
);
