import { ruta } from '@/comun/guardia';
import { leerCuerpo, validar } from '@/comun/http';
import { filtroOrdenesDto, nuevaOrdenDto } from '@/ordenes/dto';
import { crearOrden, listarOrdenes } from '@/ordenes/ordenes.service';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Cada rol ve las suyas: el mecánico, sus asignadas; el concesionario, las de sus carros.
//   ?estado=en_reparacion&buscar=ABC123&abiertas=1
export const GET = ruta('todos', async ({ url, actor }) => {
  const filtro = validar(filtroOrdenesDto, {
    estado: url.searchParams.get('estado') || undefined,
    buscar: url.searchParams.get('buscar') || undefined,
  });
  return listarOrdenes(actor, { ...filtro, abiertas: url.searchParams.get('abiertas') === '1' });
});

export const POST = ruta(
  PERSONAL,
  async ({ req, actor }) => crearOrden(actor, await leerCuerpo(req, nuevaOrdenDto)),
  201,
);
