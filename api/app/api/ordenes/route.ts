import { ruta } from '@/comun/guardia';
import { validar } from '@/comun/http';
import { filtroOrdenesDto, listarOrdenes } from '@/ordenes/ordenes.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Las órdenes llegan por el MCP (las agenda el concesionario). Aquí solo se listan.
//   El mecánico: ?vista=mias (asignadas) o ?vista=cola (de su sede, esperando mecánico).
//   La gestión: todas, con ?estado=…&taller=…&abiertas=1.
export const GET = ruta(TALLER, async ({ url, actor }) => {
  const p = url.searchParams;
  const filtro = validar(filtroOrdenesDto, {
    vista: p.get('vista') || undefined,
    estado: p.get('estado') || undefined,
    tallerId: p.get('taller') ? Number(p.get('taller')) : undefined,
    abiertas: p.get('abiertas') === '1' || undefined,
  });
  return listarOrdenes(actor, filtro);
});
