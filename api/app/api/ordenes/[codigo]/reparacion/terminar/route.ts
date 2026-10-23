import { ruta } from '@/comun/guardia';
import { terminarReparacion } from '@/reparaciones/reparaciones.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const POST = ruta<{ codigo: string }>(TALLER, async ({ actor, params }) =>
  terminarReparacion(actor, params.codigo),
);
