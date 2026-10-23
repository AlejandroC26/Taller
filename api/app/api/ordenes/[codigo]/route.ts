import { ruta } from '@/comun/guardia';
import { unaOrden } from '@/ordenes/ordenes.service';

export const runtime = 'nodejs';

export const GET = ruta<{ codigo: string }>('todos', async ({ actor, params }) =>
  unaOrden(actor, params.codigo),
);
