import { ruta } from '@/comun/guardia';
import { entero, leerCuerpo } from '@/comun/http';
import { editarItemDto } from '@/inventario/dto';
import { editarItem, unItem } from '@/inventario/inventario.service';
import { PERSONAL, TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta<{ id: string }>(TALLER, async ({ params }) => unItem(entero(params.id)));

export const PATCH = ruta<{ id: string }>(PERSONAL, async ({ req, params }) =>
  editarItem(entero(params.id), await leerCuerpo(req, editarItemDto)),
);
