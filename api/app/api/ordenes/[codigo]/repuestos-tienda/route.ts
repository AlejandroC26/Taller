import { ruta } from '@/comun/guardia';
import { buscarRepuestosParaOrden } from '@/diagnosticos/diagnosticos.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Catálogo de la tienda por código universal: ?texto=pastillas&categoria=Frenos&refrescar=true
export const GET = ruta<{ codigo: string }>(TALLER, async ({ actor, params, url }) =>
  buscarRepuestosParaOrden(actor, params.codigo, {
    texto: url.searchParams.get('texto') ?? undefined,
    categoria: url.searchParams.get('categoria') ?? undefined,
    refrescar: url.searchParams.get('refrescar') === 'true',
  }),
);
