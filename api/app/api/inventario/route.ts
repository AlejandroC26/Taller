import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { itemDto } from '@/inventario/dto';
import { crearItem, listarItems } from '@/inventario/inventario.service';
import { PERSONAL, TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// El mecánico consulta el inventario (para elegir repuestos); solo el personal lo cambia.
//   ?buscar=filtro&alertas=1&categoria=3
export const GET = ruta(TALLER, async ({ url }) =>
  listarItems({
    texto: url.searchParams.get('buscar') ?? undefined,
    soloAlertas: url.searchParams.get('alertas') === '1',
    categoriaId: Number(url.searchParams.get('categoria')) || undefined,
  }),
);

export const POST = ruta(PERSONAL, async ({ req, actor }) => crearItem(await leerCuerpo(req, itemDto), actor), 201);
