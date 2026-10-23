import { ruta } from '@/comun/guardia';
import { liquidacion } from '@/reparaciones/reparaciones.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Estimado del diagnóstico contra lo real: servicios, horas y partes.
export const GET = ruta<{ codigo: string }>(TALLER, async ({ actor, params }) =>
  liquidacion(actor, params.codigo),
);
