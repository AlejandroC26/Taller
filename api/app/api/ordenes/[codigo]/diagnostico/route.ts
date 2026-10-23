import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { guardarDiagnostico, verDiagnostico } from '@/diagnosticos/diagnosticos.service';
import { diagnosticoDto } from '@/diagnosticos/dto';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta<{ codigo: string }>(TALLER, async ({ actor, params }) =>
  verDiagnostico(actor, params.codigo),
);

// Guarda el borrador completo. El service exige que sea el mecánico asignado.
export const PUT = ruta<{ codigo: string }>(TALLER, async ({ req, actor, params }) =>
  guardarDiagnostico(actor, params.codigo, await leerCuerpo(req, diagnosticoDto)),
);
