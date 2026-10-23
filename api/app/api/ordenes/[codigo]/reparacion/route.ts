import { ruta } from '@/comun/guardia';
import { verReparacion } from '@/reparaciones/reparaciones.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta<{ codigo: string }>(TALLER, async ({ actor, params }) =>
  verReparacion(actor, params.codigo),
);
