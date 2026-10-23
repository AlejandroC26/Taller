import { ruta } from '@/comun/guardia';
import { finalizarDiagnostico } from '@/diagnosticos/diagnosticos.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const POST = ruta<{ codigo: string }>(TALLER, async ({ actor, params }) =>
  finalizarDiagnostico(actor, params.codigo),
);
