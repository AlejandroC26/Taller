import { ruta } from '@/comun/guardia';
import { entero, leerCuerpo } from '@/comun/http';
import { movimientoDto } from '@/inventario/dto';
import { movimientos, registrarMovimiento } from '@/inventario/inventario.service';
import { PERSONAL } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

export const GET = ruta<{ id: string }>(PERSONAL, async ({ params }) => movimientos(entero(params.id)));

// Entradas de mercancía, salidas manuales y ajustes por conteo físico.
export const POST = ruta<{ id: string }>(
  PERSONAL,
  async ({ req, params, actor }) => registrarMovimiento(entero(params.id), await leerCuerpo(req, movimientoDto), actor),
  201,
);
