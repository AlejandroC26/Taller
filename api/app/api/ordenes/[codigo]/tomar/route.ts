import { z } from 'zod';
import { ruta } from '@/comun/guardia';
import { leerCuerpoOpcional } from '@/comun/http';
import { tomarOrden } from '@/ordenes/ordenes.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

const tomarDto = z.object({ mecanicoId: z.uuid().optional() });

// El mecánico toma una orden de la cola de su sede (para diagnosticar o para reparar).
// La gestión indica el mecanicoId de la sede.
export const POST = ruta<{ codigo: string }>(TALLER, async ({ req, actor, params }) => {
  const { mecanicoId } = await leerCuerpoOpcional(req, tomarDto);
  return tomarOrden(actor, params.codigo, mecanicoId);
});
