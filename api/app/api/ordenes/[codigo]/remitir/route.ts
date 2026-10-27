import { ruta } from '@/comun/guardia';
import { leerCuerpo } from '@/comun/http';
import { remitirOrden } from '@/diagnosticos/diagnosticos.service';
import { remitirDto } from '@/diagnosticos/dto';
import { TALLER } from '@/usuarios/rol.entity';

export const runtime = 'nodejs';

// Después de la revisión general, el mecánico pasa la orden a una sede especializada.
export const POST = ruta<{ codigo: string }>(TALLER, async ({ req, actor, params }) => {
  const { taller, nota } = await leerCuerpo(req, remitirDto);
  return remitirOrden(actor, params.codigo, taller, nota);
});
