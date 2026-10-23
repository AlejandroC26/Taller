import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { horasDto } from '@/reparaciones/dto';
import { registrarHoras } from '@/reparaciones/reparaciones.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const POST = ruta<{ codigo: string }>(
  TALLER,
  async ({ req, actor, params }) => registrarHoras(actor, params.codigo, await leerCuerpo(req, horasDto)),
  201,
);
