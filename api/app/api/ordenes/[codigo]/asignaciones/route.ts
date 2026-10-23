import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { asignarDto, desasignarDto } from '@/ordenes/dto';
import { asignar, desasignar } from '@/ordenes/ordenes.service';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const POST = ruta<{ codigo: string }>(
  PERSONAL,
  async ({ req, actor, params }) => {
    const { mecanicoId, etapa } = await leerCuerpo(req, asignarDto);
    return asignar(actor, params.codigo, mecanicoId, etapa);
  },
  201,
);

export const DELETE = ruta<{ codigo: string }>(PERSONAL, async ({ req, actor, params }) =>
  desasignar(actor, params.codigo, (await leerCuerpo(req, desasignarDto)).asignacionId),
);
