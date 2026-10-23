import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { parteDto } from '@/reparaciones/dto';
import { registrarParte } from '@/reparaciones/reparaciones.service';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Descuenta la parte del inventario y la suma a la liquidación.
export const POST = ruta<{ codigo: string }>(
  TALLER,
  async ({ req, actor, params }) => {
    const { itemId, cantidad } = await leerCuerpo(req, parteDto);
    return registrarParte(actor, params.codigo, itemId, cantidad);
  },
  201,
);
