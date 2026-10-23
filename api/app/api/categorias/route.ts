import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { categoriaDto } from '@/inventario/dto';
import { crearCategoria, listarCategorias } from '@/inventario/inventario.service';
import { PERSONAL, TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta(TALLER, async () => listarCategorias());

export const POST = ruta(
  PERSONAL,
  async ({ req }) => crearCategoria((await leerCuerpo(req, categoriaDto)).nombre),
  201,
);
